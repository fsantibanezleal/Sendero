import { AlphaType, ColorType, Skia, type SkImage } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';
import { type Frame, useCamera, useFrameOutput, useOrientation } from 'react-native-vision-camera';
import { renderToTexture } from 'react-native-vision-camera-skia';
import { createSynchronizable, scheduleOnRN } from 'react-native-worklets';

import { log } from '../diagnostics/log';

/**
 * The live front camera as a stream of upright, mirrored Skia images, plus a person mask while the
 * reveal needs one (docs/architecture.md, docs/reveal.md).
 *
 * Every frame is drawn upright onto an offscreen GPU surface (`renderToTexture` cancels the sensor
 * rotation and applies the selfie mirror), copied to a CPU image so it can cross threads, and
 * published to a shared value the scene canvas draws (the pattern of `<SkiaCamera />`, without its
 * own canvas, so the whole experience is ONE canvas).
 *
 * The mask: while `maskActive` is on, about twice a second the upright image is drawn into a
 * small surface of the model's input size, read back as RGB floats in [0, 1] and run through the
 * MediaPipe selfie segmenter (landscape, 144 x 256, Apache-2.0); the person probability is smoothed
 * over frames (exponential moving average) and turned into an alpha image with soft edges. Because
 * it is computed from the same upright, mirrored image, it lines up with the image on screen.
 *
 * Frames and masks live only in memory: nothing is written to storage or sent anywhere.
 */

export type ModelState = 'loading' | 'ready' | 'unavailable';

export interface HeadPlace {
  x: number;
  y: number;
  width: number;
  seen: number;
}

export interface FrameSize {
  width: number;
  height: number;
}

export interface CameraFeed {
  /** The latest upright, mirrored camera frame, or null before the first frame. */
  image: SharedValue<SkImage | null>;
  /**
   * The size of the camera frames (0 x 0 before the first one). Layout reads this, never the image
   * object: a frame read on the UI thread may already be retired.
   */
  size: SharedValue<FrameSize>;
  /** The latest person mask (alpha), or null when the mask is off or not computed yet. */
  mask: SharedValue<SkImage | null>;
  /** The top of the visitor's head in the image (fractions of its size), smoothed; `seen` fades from 0 to 1. */
  head: SharedValue<HeadPlace>;
  /** Masks per second actually produced (exponential average), for the automatic mode choice. */
  maskRate: SharedValue<number>;
  modelState: ModelState;
  /** Turns the mask computation on or off (from the JS thread). */
  setMaskActive: (active: boolean) => void;
  /** Freezes the current image and mask (still-frame reveal) or resumes the live feed. */
  setFrozen: (frozen: boolean) => void;
}

/** Run the model on one frame out of MASK_EVERY. */
/** Milliseconds between person measures: the flowers follow gently, and the camera keeps its frames. */
const MASK_INTERVAL_MS = 450;
const CAMERA_SIZE = { width: 960, height: 540 };
const CAMERA_CONSTRAINTS = [{ fps: 24 }];
/** How often the camera's real rate is logged, to diagnose a device. */
const RATE_LOG_MS = 10000;
/** Weight of the newest mask in the moving average. */
const MASK_EMA = 0.6;
/** Weight of the newest head position, so the flowers do not tremble. */
const HEAD_EMA = 0.35;
/** A pixel counts as the person from this probability; the head is measured this far under its top. */
const HEAD_PROBABILITY = 0.6;
const HEAD_DROP = 0.1;
/**
 * Replaced images are disposed this many publishes later, not at once: the shared value reaches the UI
 * thread asynchronously, so the canvas may still draw (or a layer measure) the previous image for a
 * frame after the JS thread replaced it. Disposing it at once crashed the app ("Attempted to access a
 * disposed object" in a UI-thread derived value).
 */
const RETIRE_AFTER = 4;
/**
 * Frames probed at start to choose how frames reach Skia. The GPU path imports the camera's hardware
 * buffer as a texture (`renderToTexture`); some GPUs return a black texture for it (the Android
 * emulator does, while its camera delivers images). The CPU path builds the image from the frame's
 * pixel buffer instead. The probe compares both and keeps the GPU path unless it is black while the
 * pixels are not.
 */
const PROBE_FRAMES = 8;
/** Mean channel value (0 to 255) under which an image counts as black, and over which as lit. */
const BLACK_MEAN = 2;
const LIT_MEAN = 6;

// Metro bundles assets only through a static require().
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MODEL_SOURCE = require('../../assets/models/selfie_segmenter_landscape.tflite');

interface ModelInfo {
  model: TensorflowModel;
  width: number;
  height: number;
  /** Number of output channels per pixel (1: person; 2: background, person). */
  channels: number;
}

/** Loads the segmenter on the CPU: on the GPU it competes with the scene and stalls a modest tablet. */
async function loadSegmenter(): Promise<ModelInfo | null> {
  for (const delegates of [[], ['android-gpu']] as const) {
    try {
      const model = await loadTensorflowModel(MODEL_SOURCE, [...delegates]);
      const shape = model.inputs[0]?.shape ?? [];
      const out = model.outputs[0]?.shape ?? [];
      if (model.inputs[0]?.dataType !== 'float32' || shape.length !== 4 || shape[3] !== 3) {
        return null;
      }
      return { model, height: shape[1], width: shape[2], channels: out[3] ?? 1 };
    } catch {
      // Try the next delegate.
    }
  }
  return null;
}

export function useCameraFeed(active: boolean): CameraFeed {
  const image = useSharedValue<SkImage | null>(null);
  const size = useSharedValue<FrameSize>({ width: 0, height: 0 });
  const mask = useSharedValue<SkImage | null>(null);
  const retired = useRef<SkImage[]>([]);
  const maskRate = useSharedValue(0);
  const head = useSharedValue<HeadPlace>({ x: 0.5, y: 0.3, width: 0.2, seen: 0 });
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [modelState, setModelState] = useState<ModelState>('loading');

  const flags = useMemo(() => createSynchronizable({ maskActive: false, frozen: false }), []);
  // Backpressure: at most one frame on its way to the JS thread. Without it a slow device queues CPU
  // frame copies (several MB each) faster than JS drains them, starving touches and React updates
  // (seen on the emulator: 1.8 GB and taps never handled).
  const inFlight = useMemo(() => createSynchronizable(false), []);

  useEffect(() => {
    let cancelled = false;
    loadSegmenter().then((m) => {
      if (cancelled) return;
      setInfo(m);
      setModelState(m == null ? 'unavailable' : 'ready');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const frames = useRef(0);
  const ratedAt = useRef(0);
  const firstFrame = useRef(true);

  const report = useCallback((message: string) => log(`camera: ${message}`), []);

  /** Disposes a replaced image only after RETIRE_AFTER more replacements (see RETIRE_AFTER). */
  const retire = useCallback((old: SkImage | null) => {
    if (old == null) return;
    const queue = retired.current;
    queue.push(old);
    while (queue.length > RETIRE_AFTER * 2) {
      queue.shift()?.dispose();
    }
  }, []);

  const publish = useCallback(
    (next: SkImage, measured: boolean, found: HeadPlace | null) => {
      inFlight.setBlocking(false);
      const w = next.width();
      const h = next.height();
      if (firstFrame.current) {
        firstFrame.current = false;
        log(`camera: first frame ${w} x ${h}`);
      }
      const current = size.get();
      if (current.width !== w || current.height !== h) {
        size.set({ width: w, height: h });
      }
      retire(image.get());
      image.set(next);
      frames.current += 1;
      const now = Date.now();
      if (ratedAt.current === 0) ratedAt.current = now;
      if (now - ratedAt.current >= RATE_LOG_MS) {
        log(`camera: ${((frames.current * 1000) / (now - ratedAt.current)).toFixed(1)} frames per second reach the scene`);
        frames.current = 0;
        ratedAt.current = now;
      }
      if (measured) {
        const h = head.get();
        // Follows the person gently; a measure that is lost fades the flowers without moving them.
        if (found != null) {
          const k = h.seen < 0.05 ? 1 : HEAD_EMA;
          head.set({ x: h.x + (found.x - h.x) * k, y: h.y + (found.y - h.y) * k, width: h.width + (found.width - h.width) * k, seen: Math.min(1, h.seen + 0.34) });
        } else {
          head.set({ ...h, seen: Math.max(0, h.seen - 0.34) });
        }
      }
    },
    [image, size, head, inFlight, retire],
  );

  const setMaskActive = useCallback(
    (on: boolean) => {
      flags.setBlocking((f) => ({ ...f, maskActive: on }));
      if (!on) {
        head.set({ ...head.get(), seen: 0 });
      }
    },
    [flags, head],
  );

  const setFrozen = useCallback(
    (frozen: boolean) => {
      flags.setBlocking((f) => ({ ...f, frozen }));
    },
    [flags],
  );

  const model = info?.model;
  const inW = info?.width ?? 0;
  const inH = info?.height ?? 0;
  const channels = info?.channels ?? 1;

  const frameOutput = useFrameOutput({
    // RGB: 'native' resolves to PRIVATE, which some devices refuse for image analysis, and YUV hardware
    // buffers were imported as black frames on the emulator; RGBA buffers import everywhere (CameraX
    // converts, a small CPU cost per frame).
    pixelFormat: 'rgb',
    dropFramesWhileBusy: true,
    allowDeferredStart: false,
    // The camera is a small part of the screen most of the time: this size and rate keep a modest tablet fluid.
    targetResolution: CAMERA_SIZE,
    onFrame: (frame) => {
      'worklet';
      let snapshot: SkImage | undefined;
      let cpu: CpuFrame | null = null;
      try {
        const state = flags.getBlocking();
        if (state.frozen || inFlight.getBlocking()) {
          return;
        }
        const g = globalThis as unknown as { __senderoSource?: SourceState; __senderoMask?: MaskScratch };
        if (g.__senderoSource == null) {
          g.__senderoSource = { mode: 'probe', probes: 0, gpuSum: 0, cpuSum: 0, cpuReads: 0, maskError: false, frameError: false };
        }
        const source = g.__senderoSource;
        if (source.mode !== 'gpu') {
          cpu = cpuFrame(frame, source.mode === 'probe');
        }
        const raster = source.mode === 'cpu' && cpu != null ? cpu.image : null;
        snapshot = renderToTexture(frame, ({ canvas, frameTexture }) => {
          canvas.drawImage(raster ?? frameTexture, 0, 0);
        });
        if (source.mode === 'probe') {
          source.gpuSum += meanOfImage(snapshot);
          source.probes += 1;
          if (cpu != null) {
            source.cpuSum += cpu.mean;
            source.cpuReads += 1;
          }
          if (source.probes >= PROBE_FRAMES) {
            const gpu = source.gpuSum / source.probes;
            const pixels = source.cpuReads > 0 ? source.cpuSum / source.cpuReads : -1;
            source.mode = source.cpuReads === source.probes && gpu < BLACK_MEAN && pixels > LIT_MEAN ? 'cpu' : 'gpu';
            const cpuNote = source.cpuReads === 0 ? 'pixels not readable on the CPU' : `mean of the pixels ${pixels.toFixed(1)}`;
            scheduleOnRN(report, `${source.mode} frames (mean of the GPU copy ${gpu.toFixed(1)}, ${cpuNote})`);
          }
        }

        let measured = false;
        let found: HeadPlace | null = null;
        if (state.maskActive && model != null && inW > 0) {
          // Per-runtime scratch state survives between frames on the camera thread.
          if (g.__senderoMask == null || g.__senderoMask.width !== inW) {
            g.__senderoMask = createScratch(inW, inH);
          }
          const scratch = g.__senderoMask;
          const now = Date.now();
          if (now - scratch.measuredAt >= MASK_INTERVAL_MS) {
            scratch.measuredAt = now;
            try {
              measured = computeMask(snapshot, model, scratch, channels);
              found = measured ? findHead(scratch) : null;
            } catch (e) {
              if (!source.maskError) {
                source.maskError = true;
                scheduleOnRN(report, `person mask failed: ${String(e)}`);
              }
            }
          }
        }

        const cpuImage = snapshot.makeNonTextureImage();
        if (cpuImage != null) {
          inFlight.setBlocking(true);
          scheduleOnRN(publish, cpuImage, measured, found);
        }
      } catch (e) {
        // Reported once; the next frame tries again.
        const g = globalThis as unknown as { __senderoSource?: SourceState };
        if (g.__senderoSource != null && !g.__senderoSource.frameError) {
          g.__senderoSource.frameError = true;
          scheduleOnRN(report, `frame failed: ${String(e)}`);
        }
      } finally {
        cpu?.image.dispose();
        snapshot?.dispose();
        frame.dispose();
      }
    },
  });

  useCamera({
    isActive: active,
    device: 'front',
    outputs: [frameOutput],
    constraints: CAMERA_CONSTRAINTS,
    mirrorMode: 'on',
    orientationSource: 'custom',
  });

  const orientation = useOrientation('interface') ?? 'up';
  useEffect(() => {
    // outputOrientation is a setter on the native frame output (VisionCamera API), not React state.
    // eslint-disable-next-line react-hooks/immutability
    frameOutput.outputOrientation = orientation;
  }, [frameOutput, orientation]);

  useEffect(
    () => () => {
      for (const old of retired.current) old.dispose();
      retired.current = [];
    },
    [],
  );

  return { image, size, mask, head, maskRate, modelState, setMaskActive, setFrozen };
}

interface SourceState {
  mode: 'probe' | 'gpu' | 'cpu';
  probes: number;
  gpuSum: number;
  cpuSum: number;
  /** Probe frames whose pixels could be read on the CPU. */
  cpuReads: number;
  maskError: boolean;
  frameError: boolean;
}

interface CpuFrame {
  image: SkImage;
  /** Mean channel value of a sample of the pixels (only while probing). */
  mean: number;
}

/**
 * The frame's pixels read on the CPU: from its single plane, else from its pixel buffer. Either read
 * can fail (the Android emulator reports its camera buffers as CPU-readable and then refuses the
 * read): every failure returns null, never an exception that would stop the camera.
 */
function readPixels(frame: Frame): { bytes: Uint8Array; rowBytes: number } | null {
  'worklet';
  try {
    if (frame.isPlanar) return null;
    const planes = frame.getPlanes();
    if (planes.length === 1) {
      return { bytes: new Uint8Array(planes[0].getPixelBuffer()), rowBytes: planes[0].bytesPerRow };
    }
  } catch {
    // Try the pixel buffer next.
  }
  try {
    if (!frame.hasPixelBuffer) return null;
    return { bytes: new Uint8Array(frame.getPixelBuffer()), rowBytes: frame.bytesPerRow };
  } catch {
    return null;
  }
}

/** The frame as a raster image built from its pixels (RGBA or BGRA frames only), or null. */
function cpuFrame(frame: Frame, measure: boolean): CpuFrame | null {
  'worklet';
  const format = frame.pixelFormat;
  if (format !== 'rgb-rgba-8-bit' && format !== 'rgb-bgra-8-bit') return null;
  const read = readPixels(frame);
  if (read == null || read.bytes.length < frame.height * read.rowBytes) return null;
  const bytes = read.bytes;
  let mean = 0;
  if (measure) {
    const samples = 256;
    const step = Math.max(4, Math.floor(bytes.length / samples / 4) * 4);
    let sum = 0;
    let n = 0;
    for (let o = 0; o + 2 < bytes.length && n < samples; o += step) {
      sum += bytes[o] + bytes[o + 1] + bytes[o + 2];
      n += 1;
    }
    mean = n > 0 ? sum / (3 * n) : 0;
  }
  const image = Skia.Image.MakeImage(
    {
      width: frame.width,
      height: frame.height,
      colorType: format === 'rgb-rgba-8-bit' ? ColorType.RGBA_8888 : ColorType.BGRA_8888,
      alphaType: AlphaType.Unpremul,
    },
    Skia.Data.fromBytes(bytes),
    read.rowBytes,
  );
  return image == null ? null : { image, mean };
}

/** Mean channel value of an image, read back from a 32 x 18 copy (only while probing). */
function meanOfImage(image: SkImage): number {
  'worklet';
  const w = 32;
  const h = 18;
  const surface = Skia.Surface.MakeOffscreen(w, h);
  if (surface == null) return 0;
  try {
    surface.getCanvas().drawImageRect(image, Skia.XYWHRect(0, 0, image.width(), image.height()), Skia.XYWHRect(0, 0, w, h), Skia.Paint());
    surface.flush();
    const small = surface.makeImageSnapshot();
    const px = small.readPixels(0, 0, { width: w, height: h, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
    small.dispose();
    if (px == null) return 0;
    const bytes = px as Uint8Array;
    let sum = 0;
    for (let i = 0; i < w * h; i++) sum += bytes[4 * i] + bytes[4 * i + 1] + bytes[4 * i + 2];
    return sum / (3 * w * h);
  } finally {
    surface.dispose();
  }
}

interface MaskScratch {
  width: number;
  height: number;
  measuredAt: number;
  input: Float32Array;
  smooth: Float32Array;
  hasPrevious: boolean;
}

/**
 * The top of the head from the smoothed person mask: the first rows that hold enough of the person, and the longest
 * run a little under them, which is the width of the head. Works with the hair, where a face detector would only
 * see the face. Null when nobody is there or the shape is no head (a shoulder filling the image).
 */
export function findHead(s: { width: number; height: number; smooth: Float32Array }): HeadPlace | null {
  'worklet';
  const { width: w, height: h, smooth } = s;
  let top = -1;
  for (let y = 0; y < h && top < 0; y++) {
    let count = 0;
    for (let x = 0; x < w; x++) if (smooth[y * w + x] > HEAD_PROBABILITY) count++;
    if (count >= w * 0.02) top = y;
  }
  if (top < 0) return null;
  const row = Math.min(h - 1, top + Math.round(h * HEAD_DROP));
  let bestStart = 0;
  let bestLength = 0;
  let start = -1;
  for (let x = 0; x <= w; x++) {
    const on = x < w && smooth[row * w + x] > HEAD_PROBABILITY;
    if (on && start < 0) start = x;
    if (!on && start >= 0) {
      if (x - start > bestLength) {
        bestLength = x - start;
        bestStart = start;
      }
      start = -1;
    }
  }
  if (bestLength < w * 0.04 || bestLength > w * 0.6) return null;
  return { x: (bestStart + bestLength / 2) / w, y: top / h, width: bestLength / w, seen: 1 };
}

function createScratch(width: number, height: number): MaskScratch {
  'worklet';
  const n = width * height;
  return {
    width,
    height,
    measuredAt: 0,
    input: new Float32Array(n * 3),
    smooth: new Float32Array(n),
    hasPrevious: false,
  };
}

/** Runs the segmenter on the upright image and updates the smoothed person mask; true when it ran. */
function computeMask(source: SkImage, model: TensorflowModel, s: MaskScratch, channels: number): boolean {
  'worklet';
  const surface = Skia.Surface.MakeOffscreen(s.width, s.height);
  if (surface == null) {
    return false;
  }
  try {
    const canvas = surface.getCanvas();
    const paint = Skia.Paint();
    canvas.drawImageRect(
      source,
      Skia.XYWHRect(0, 0, source.width(), source.height()),
      Skia.XYWHRect(0, 0, s.width, s.height),
      paint,
    );
    surface.flush();
    const small = surface.makeImageSnapshot();
    const pixels = small.readPixels(0, 0, {
      width: s.width,
      height: s.height,
      colorType: ColorType.RGBA_8888,
      alphaType: AlphaType.Unpremul,
    });
    small.dispose();
    if (pixels == null) {
      return false;
    }
    const n = s.width * s.height;
    const px = pixels as Uint8Array;
    for (let i = 0; i < n; i++) {
      s.input[3 * i] = px[4 * i] / 255;
      s.input[3 * i + 1] = px[4 * i + 1] / 255;
      s.input[3 * i + 2] = px[4 * i + 2] / 255;
    }
    const outputs = model.runSync([s.input.buffer as ArrayBuffer]);
    const out = new Float32Array(outputs[0]);
    for (let i = 0; i < n; i++) {
      const p = channels >= 2 ? out[channels * i + 1] : out[i];
      s.smooth[i] = s.hasPrevious ? MASK_EMA * p + (1 - MASK_EMA) * s.smooth[i] : p;
    }
    s.hasPrevious = true;
    return true;
  } finally {
    surface.dispose();
  }
}
