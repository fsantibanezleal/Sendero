import { AlphaType, ColorType, Skia, type SkImage } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';
import { useCamera, useFrameOutput, useOrientation } from 'react-native-vision-camera';
import { renderToTexture } from 'react-native-vision-camera-skia';
import { createSynchronizable, scheduleOnRN } from 'react-native-worklets';

/**
 * The live front camera as a stream of upright, mirrored Skia images, plus a person mask while the
 * reveal needs one (docs/architecture.md, docs/reveal.md).
 *
 * Every frame is drawn upright onto an offscreen GPU surface (`renderToTexture` cancels the sensor
 * rotation and applies the selfie mirror), copied to a CPU image so it can cross threads, and
 * published to a shared value the scene canvas draws (the pattern of `<SkiaCamera />`, without its
 * own canvas, so the whole experience is ONE canvas).
 *
 * The mask: while `maskActive` is on, every MASK_EVERY-th frame the upright image is drawn into a
 * small surface of the model's input size, read back as RGB floats in [0, 1] and run through the
 * MediaPipe selfie segmenter (landscape, 144 x 256, Apache-2.0); the person probability is smoothed
 * over frames (exponential moving average) and turned into an alpha image with soft edges. Because
 * it is computed from the same upright, mirrored image, it lines up with the image on screen.
 *
 * Frames and masks live only in memory: nothing is written to storage or sent anywhere.
 */

export type ModelState = 'loading' | 'ready' | 'unavailable';

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
  /** Masks per second actually produced (exponential average), for the automatic mode choice. */
  maskRate: SharedValue<number>;
  modelState: ModelState;
  /** Turns the mask computation on or off (from the JS thread). */
  setMaskActive: (active: boolean) => void;
  /** Freezes the current image and mask (still-frame reveal) or resumes the live feed. */
  setFrozen: (frozen: boolean) => void;
}

/** Run the model on one frame out of MASK_EVERY. */
const MASK_EVERY = 2;
/** Weight of the newest mask in the moving average. */
const MASK_EMA = 0.6;
/** Probability band mapped to the soft edge of the cut-out. */
const EDGE_LOW = 0.3;
const EDGE_HIGH = 0.7;
/**
 * Replaced images are disposed this many publishes later, not at once: the shared value reaches the UI
 * thread asynchronously, so the canvas may still draw (or a layer measure) the previous image for a
 * frame after the JS thread replaced it. Disposing it at once crashed the app ("Attempted to access a
 * disposed object" in a UI-thread derived value).
 */
const RETIRE_AFTER = 4;

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

/** Loads the segmenter on the GPU delegate, falling back to the CPU. */
async function loadSegmenter(): Promise<ModelInfo | null> {
  for (const delegates of [['android-gpu'], []] as const) {
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

  const lastMaskAt = useSharedValue(0);

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
    (next: SkImage, nextMask: SkImage | null) => {
      inFlight.setBlocking(false);
      const w = next.width();
      const h = next.height();
      const current = size.get();
      if (current.width !== w || current.height !== h) {
        size.set({ width: w, height: h });
      }
      retire(image.get());
      image.set(next);
      if (nextMask != null) {
        retire(mask.get());
        mask.set(nextMask);
        const now = Date.now();
        const dt = (now - lastMaskAt.get()) / 1000;
        lastMaskAt.set(now);
        if (dt > 0 && dt < 2) {
          maskRate.set(maskRate.get() * 0.8 + (1 / dt) * 0.2);
        }
      }
    },
    [image, size, mask, maskRate, lastMaskAt, inFlight, retire],
  );

  const setMaskActive = useCallback(
    (on: boolean) => {
      flags.setBlocking((f) => ({ ...f, maskActive: on }));
      if (!on) {
        retire(mask.get());
        mask.set(null);
        maskRate.set(0);
      }
    },
    [flags, mask, maskRate, retire],
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
    enablePreviewSizedOutputBuffers: true,
    onFrame: (frame) => {
      'worklet';
      let snapshot: SkImage | undefined;
      try {
        const state = flags.getBlocking();
        if (state.frozen || inFlight.getBlocking()) {
          return;
        }
        snapshot = renderToTexture(frame, ({ canvas, frameTexture }) => {
          canvas.drawImage(frameTexture, 0, 0);
        });

        let maskImage: SkImage | null = null;
        if (state.maskActive && model != null && inW > 0) {
          // Per-runtime scratch state survives between frames on the camera thread.
          const g = globalThis as unknown as { __senderoMask?: MaskScratch };
          if (g.__senderoMask == null || g.__senderoMask.width !== inW) {
            g.__senderoMask = createScratch(inW, inH);
          }
          const scratch = g.__senderoMask;
          scratch.frame += 1;
          if (scratch.frame % MASK_EVERY === 0) {
            maskImage = computeMask(snapshot, model, scratch, channels);
          }
        }

        const cpuImage = snapshot.makeNonTextureImage();
        if (cpuImage != null) {
          inFlight.setBlocking(true);
          scheduleOnRN(publish, cpuImage, maskImage);
        } else {
          maskImage?.dispose();
        }
      } finally {
        snapshot?.dispose();
        frame.dispose();
      }
    },
  });

  useCamera({
    isActive: active,
    device: 'front',
    outputs: [frameOutput],
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

  return { image, size, mask, maskRate, modelState, setMaskActive, setFrozen };
}

interface MaskScratch {
  width: number;
  height: number;
  frame: number;
  input: Float32Array;
  smooth: Float32Array;
  rgba: Uint8Array;
  hasPrevious: boolean;
}

function createScratch(width: number, height: number): MaskScratch {
  'worklet';
  const n = width * height;
  return {
    width,
    height,
    frame: 0,
    input: new Float32Array(n * 3),
    smooth: new Float32Array(n),
    rgba: new Uint8Array(n * 4),
    hasPrevious: false,
  };
}

/** Runs the segmenter on the upright image and returns the smoothed person mask as an image. */
function computeMask(source: SkImage, model: TensorflowModel, s: MaskScratch, channels: number): SkImage | null {
  'worklet';
  const surface = Skia.Surface.MakeOffscreen(s.width, s.height);
  if (surface == null) {
    return null;
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
      return null;
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
    const span = EDGE_HIGH - EDGE_LOW;
    for (let i = 0; i < n; i++) {
      const p = channels >= 2 ? out[channels * i + 1] : out[i];
      const m = s.hasPrevious ? MASK_EMA * p + (1 - MASK_EMA) * s.smooth[i] : p;
      s.smooth[i] = m;
      let a = (m - EDGE_LOW) / span;
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      a = a * a * (3 - 2 * a);
      const o = 4 * i;
      s.rgba[o] = 255;
      s.rgba[o + 1] = 255;
      s.rgba[o + 2] = 255;
      s.rgba[o + 3] = Math.round(a * 255);
    }
    s.hasPrevious = true;
    const data = Skia.Data.fromBytes(s.rgba);
    return Skia.Image.MakeImage(
      { width: s.width, height: s.height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul },
      data,
      s.width * 4,
    );
  } finally {
    surface.dispose();
  }
}
