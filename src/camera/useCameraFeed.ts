import { AlphaType, ColorType, Skia, type SkImage } from '@shopify/react-native-skia';
import { Image as RNImage } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';
import { type CameraPreviewOutput, type Frame, useCamera, useFrameOutput, useOrientation, usePreviewOutput } from 'react-native-vision-camera';
import { renderToTexture } from 'react-native-vision-camera-skia';
import { createSynchronizable, scheduleOnRN } from 'react-native-worklets';

import { log } from '../diagnostics/log';
import { rawResourceToFile } from '../kiosk/kiosk';

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
  /** Tilt of the head (radians, from the line of the eyes). */
  angle: number;
  seen: number;
}

export interface FrameSize {
  width: number;
  height: number;
}

export interface CameraFeed {
  /** The live camera for the native preview view (`CameraView.tsx`); the scene never copies its frames. */
  preview: CameraPreviewOutput;
  /** Unused since the native preview: always null. */
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
const CAMERA_SIZE = { width: 640, height: 360 };
const CAMERA_CONSTRAINTS = [{ fps: 24 }];
/** How often the camera's real rate is logged, to diagnose a device. */
const RATE_LOG_MS = 10000;
/** Weight of the newest head position, so the flowers do not tremble. */
const HEAD_EMA = 0.35;
/** A face counts from this detector confidence. */
const FACE_SCORE = 0.6;
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
const MODEL_SOURCE = require('../../assets/models/blaze_face_short_range.tflite');

interface ModelInfo {
  model: TensorflowModel;
  width: number;
  height: number;
  /** Number of output channels per pixel (1: person; 2: background, person). */
  channels: number;
}

/**
 * Where the model file is. In a release build a bundled file is an Android raw resource whose name is no URL, which
 * the model loader rejected ("no protocol"), so the visitor's flowers never showed on a device: it is copied to a file.
 */
function modelSource(): { url: string } | number {
  const uri = RNImage.resolveAssetSource(MODEL_SOURCE)?.uri ?? '';
  if (uri.includes('://')) return MODEL_SOURCE;
  const path = rawResourceToFile(uri, 'face-detector.tflite');
  log(`camera: person model from ${path == null ? `resource ${uri}, not copied` : 'its copied file'}`);
  return path == null ? MODEL_SOURCE : { url: `file://${path}` };
}

/** Loads the segmenter on the CPU: on the GPU it competes with the scene and stalls a modest tablet. */
async function loadSegmenter(): Promise<ModelInfo | null> {
  for (const delegates of [[], ['android-gpu']] as const) {
    try {
      const model = await loadTensorflowModel(modelSource(), [...delegates]);
      const shape = model.inputs[0]?.shape ?? [];
      if (model.inputs[0]?.dataType !== 'float32' || shape.length !== 4 || shape[3] !== 3) {
        log(`camera: person model has an unexpected input (${model.inputs[0]?.dataType} ${JSON.stringify(shape)})`);
        return null;
      }
      const boxes = model.outputs.findIndex((o) => o.shape[o.shape.length - 1] === 16);
      log(`camera: face model inputs ${JSON.stringify(shape)}, outputs ${JSON.stringify(model.outputs.map((o) => o.shape))}`);
      if (boxes < 0 || model.outputs.length < 2) return null;
      return { model, height: shape[1], width: shape[2], channels: boxes };
    } catch (e) {
      log(`camera: person model failed to load with [${delegates.join(', ')}]: ${String(e)}`);
    }
  }
  return null;
}

export function useCameraFeed(active: boolean): CameraFeed {
  const image = useSharedValue<SkImage | null>(null);
  const size = useSharedValue<FrameSize>({ width: 0, height: 0 });
  const mask = useSharedValue<SkImage | null>(null);
  const maskRate = useSharedValue(0);
  const head = useSharedValue<HeadPlace>({ x: 0.5, y: 0.3, width: 0.2, angle: 0, seen: 0 });
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [modelState, setModelState] = useState<ModelState>('loading');

  const flags = useMemo(() => createSynchronizable({ maskActive: false, frozen: false }), []);
  // Backpressure: at most one frame on its way to the UI thread. Without it a slow device queues CPU
  // frame copies (several MB each) faster than they drain (seen on the emulator: 1.8 GB and taps never handled).
  const inFlight = useMemo(() => createSynchronizable(false), []);

  useEffect(() => {
    let cancelled = false;
    loadSegmenter().then((m) => {
      if (cancelled) return;
      setInfo(m);
      setModelState(m == null ? 'unavailable' : 'ready');
      log(m == null ? 'camera: person model unavailable' : `camera: person model ready (${m.width} x ${m.height})`);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const report = useCallback((message: string) => log(`camera: ${message}`), []);

  // What the scene holds, kept here too. Reading a shared value on the JS thread waits for the UI thread: on the TCL
  // Tab A1 Plus that made a frame take 1.4 to 10 seconds to pass, with the JS thread idle and the video frozen.
  const shown = useRef({ width: 0, height: 0 });
  const place = useRef<HeadPlace>({ x: 0.5, y: 0.3, width: 0.2, angle: 0, seen: 0 });
  const rate = useRef({ frames: 0, at: 0 });

  /** Hands a finished frame to the scene. Only writes shared values, it never reads them. */
  const publish = useCallback(
    (w: number, h: number, measured: boolean, found: HeadPlace | null) => {
      inFlight.setBlocking(false);
      const current = shown.current;
      if (current.width === 0) log(`camera: first frame ${w} x ${h}`);
      if (current.width !== w || current.height !== h) {
        current.width = w;
        current.height = h;
        size.set({ width: w, height: h });
      }
      const r = rate.current;
      r.frames += 1;
      const now = Date.now();
      if (r.at === 0) r.at = now;
      if (now - r.at >= RATE_LOG_MS) {
        log(`camera: ${((r.frames * 1000) / (now - r.at)).toFixed(1)} person measures per second`);
        r.frames = 0;
        r.at = now;
      }
      if (measured) {
        const p = place.current;
        // Follows the person gently; a measure that is lost fades the flowers without moving them.
        if (found != null) {
          const k = p.seen < 0.05 ? 1 : HEAD_EMA;
          place.current = { x: p.x + (found.x - p.x) * k, y: p.y + (found.y - p.y) * k, width: p.width + (found.width - p.width) * k, angle: p.angle + (found.angle - p.angle) * k, seen: Math.min(1, p.seen + 0.34) };
        } else {
          // A missed measure fades the crown slowly: the detector misses a frame now and then.
          place.current = { ...p, seen: Math.max(0, p.seen - 0.12) };
        }
        head.set(place.current);
      }
    },
    [size, head, inFlight],
  );

  const setMaskActive = useCallback(
    (on: boolean) => {
      flags.setBlocking((f) => ({ ...f, maskActive: on }));
      if (!on) {
        place.current = { ...place.current, seen: 0 };
        head.set(place.current);
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

  const preview = usePreviewOutput();
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
        const t0 = Date.now();
        const stats = frameStats();
        stats.calls += 1;
        const state = flags.getBlocking();
        if (t0 - stats.at > 10000) {
          // One line every 10 s, whatever happens below: whether frames arrive and why they are skipped.
          const g0 = globalThis as unknown as { __senderoMask?: MaskScratch };
          scheduleOnRN(report, `${stats.calls} frames in 10 s, ${stats.done} measured, ${stats.faces} faces (last best score ${(g0.__senderoMask?.lastScore ?? 0).toFixed(2)}); mask ${state.maskActive ? 'on' : 'off'}, model ${model == null ? 'missing' : 'loaded'}`);
          Object.assign(stats, { calls: 0, busy: 0, done: 0, faces: 0, read: 0, render: 0, probe: 0, measure: 0, copy: 0, at: t0 });
        }
        if (state.frozen || inFlight.getBlocking() || !state.maskActive || model == null || inW <= 0) {
          stats.busy += 1;
          return;
        }
        const g = globalThis as unknown as { __senderoSource?: SourceState; __senderoMask?: MaskScratch };
        if (g.__senderoMask != null && t0 - g.__senderoMask.measuredAt < MASK_INTERVAL_MS) {
          stats.busy += 1;
          return;
        }
        if (g.__senderoSource == null) {
          g.__senderoSource = { mode: 'probe', probes: 0, gpuSum: 0, cpuSum: 0, cpuReads: 0, maskError: false, frameError: false };
        }
        const source = g.__senderoSource;
        if (source.mode !== 'gpu') {
          cpu = cpuFrame(frame, source.mode === 'probe');
        }
        const t1 = Date.now();
        const raster = source.mode === 'cpu' && cpu != null ? cpu.image : null;
        snapshot = renderToTexture(frame, ({ canvas, frameTexture }) => {
          canvas.drawImage(raster ?? frameTexture, 0, 0);
        });
        const t2 = Date.now();
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

        const t3 = Date.now();
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
              found = detectFace(snapshot, model, scratch, channels);
              measured = true;
              if (found != null) stats.faces += 1;
            } catch (e) {
              if (!source.maskError) {
                source.maskError = true;
                scheduleOnRN(report, `person mask failed: ${String(e)}`);
              }
            }
          }
        }

        const t4 = Date.now();
        const t5 = Date.now();
        stats.read += t1 - t0;
        stats.render += t2 - t1;
        stats.probe += t3 - t2;
        stats.measure += t4 - t3;
        stats.copy += t5 - t4;
        stats.done += 1;
        inFlight.setBlocking(true);
        scheduleOnRN(publish, snapshot.width(), snapshot.height(), measured, found);
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
    outputs: [preview, frameOutput],
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

  return { preview, image, size, mask, head, maskRate, modelState, setMaskActive, setFrozen };
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

interface FrameStats {
  calls: number;
  faces: number;
  busy: number;
  done: number;
  read: number;
  render: number;
  probe: number;
  measure: number;
  copy: number;
  at: number;
}

/** Timings of the frame path on the camera thread, logged every few seconds to diagnose a device. */
function frameStats(): FrameStats {
  'worklet';
  const g = globalThis as unknown as { __senderoStats?: FrameStats };
  if (g.__senderoStats == null) {
    g.__senderoStats = { faces: 0, calls: 0, busy: 0, done: 0, read: 0, render: 0, probe: 0, measure: 0, copy: 0, at: Date.now() };
  }
  return g.__senderoStats;
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
  /** Anchor centres of the face detector (x, y in 0..1), in the order of its outputs. */
  anchors: Float32Array;
  /** The best face score of the last measure, for the log. */
  lastScore: number;
}


/**
 * Anchor centres of BlazeFace short range (128 x 128): strides 8 then 16, 16, 16, two anchors per layer and cell, the
 * layers of the same stride sharing the grid (896 anchors), as MediaPipe's SSD anchor calculator lays them out.
 */
function faceAnchors(size: number): Float32Array {
  'worklet';
  const layers = [
    { stride: 8, count: 2 },
    { stride: 16, count: 6 },
  ];
  const out: number[] = [];
  for (const layer of layers) {
    const cells = Math.ceil(size / layer.stride);
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        for (let k = 0; k < layer.count; k++) out.push((x + 0.5) / cells, (y + 0.5) / cells);
      }
    }
  }
  return new Float32Array(out);
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
    anchors: faceAnchors(width),
    lastScore: 0,
    hasPrevious: false,
  };
}


/**
 * The visitor's head from the face detector (Google BlazeFace short range, Apache-2.0, on the CPU): the centre square
 * of the upright frame is scaled to 128 x 128, the most confident face is decoded from its anchor, and the top of the
 * head is placed a little above the face box, where the hair is. Null when no face is seen.
 */
function detectFace(source: SkImage, model: TensorflowModel, s: MaskScratch, boxIndex: number): HeadPlace | null {
  'worklet';
  const surface = Skia.Surface.MakeOffscreen(s.width, s.height);
  if (surface == null) return null;
  try {
    const w = source.width();
    const h = source.height();
    // The whole frame, letterboxed into the square: with the tablet upright the frame is tall, and a centre square
    // cut the face off when it sat in the upper part of the picture.
    const k = s.width / Math.max(w, h);
    const dw = w * k;
    const dh = h * k;
    const ox = (s.width - dw) / 2;
    const oy = (s.height - dh) / 2;
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('black'));
    canvas.drawImageRect(source, Skia.XYWHRect(0, 0, w, h), Skia.XYWHRect(ox, oy, dw, dh), Skia.Paint());
    surface.flush();
    const small = surface.makeImageSnapshot();
    const pixels = small.readPixels(0, 0, { width: s.width, height: s.height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
    small.dispose();
    if (pixels == null) return null;
    const n = s.width * s.height;
    const px = pixels as Uint8Array;
    for (let i = 0; i < n; i++) {
      s.input[3 * i] = px[4 * i] / 127.5 - 1;
      s.input[3 * i + 1] = px[4 * i + 1] / 127.5 - 1;
      s.input[3 * i + 2] = px[4 * i + 2] / 127.5 - 1;
    }
    const outputs = model.runSync([s.input.buffer as ArrayBuffer]);
    const boxes = new Float32Array(outputs[boxIndex]);
    const scores = new Float32Array(outputs[boxIndex === 0 ? 1 : 0]);
    let best = -1;
    let bestScore = FACE_SCORE;
    let top = 0;
    const count = Math.min(scores.length, s.anchors.length / 2);
    for (let i = 0; i < count; i++) {
      const raw = Math.max(-100, Math.min(100, scores[i]));
      const score = 1 / (1 + Math.exp(-raw));
      if (score > top) top = score;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    s.lastScore = top;
    if (best < 0) return null;
    const fw = boxes[best * 16 + 2] / s.width;
    const fh = boxes[best * 16 + 3] / s.height;
    // The six keypoints follow the box: right eye, left eye, nose, mouth, right ear, left ear (x, y pairs).
    const kp = (k: number, axis: number) => boxes[best * 16 + 4 + k * 2 + axis] / s.width + s.anchors[best * 2 + axis];
    const angle = Math.atan2(kp(1, 1) - kp(0, 1), kp(1, 0) - kp(0, 0));
    const ears = Math.hypot(kp(5, 0) - kp(4, 0), kp(5, 1) - kp(4, 1));
    const headW = Math.max(fw * 1.2, ears * 1.15);
    // Back to fractions of the whole frame; the hair line is about two thirds of a face height above the eyes, along
    // the head's own up direction when it tilts.
    const eyeX = (kp(0, 0) + kp(1, 0)) / 2;
    const eyeY = (kp(0, 1) + kp(1, 1)) / 2;
    const up = fh * 0.75;
    return {
      x: ((eyeX + Math.sin(angle) * up) * s.width - ox) / dw,
      y: ((eyeY - Math.cos(angle) * up) * s.height - oy) / dh,
      width: (headW * s.width) / dw,
      angle,
      seen: 1,
    };
  } finally {
    surface.dispose();
  }
}

