/**
 * The experience timeline: every phase of a visit, in seconds from the visitor's touch.
 * Single source of truth for the scene, the sound and the camera mask (plans/sendero plan.md
 * section 3); tune values here, never in the layers.
 */

export type Phase =
  | 'idle'
  | 'shrink'
  | 'path'
  | 'gather'
  | 'walk'
  | 'arrive'
  | 'reveal'
  | 'message'
  | 'return';

export interface PhaseWindow {
  start: number;
  end: number;
}

/** Phases overlap on purpose (the path starts while the frame is still shrinking). */
export const TIMELINE = {
  shrink: { start: 0.0, end: 1.4 },
  path: { start: 0.8, end: 3.6 },
  gather: { start: 2.8, end: 4.2 },
  walk: { start: 4.2, end: 11.2 },
  /** The family of six appears in the upper left while the path starts, and stays until the arrival. */
  family: { start: 0.8, end: 2.2 },
  arrive: { start: 11.2, end: 12.4 },
  reveal: { start: 12.4, end: 15.4 },
  message: { start: 15.4, end: 25.4 },
  /** The voice starts with the message (its clip opens with 0.4 s of silence). */
  whisperAt: 15.5,
  return: { start: 25.4, end: 26.8 },
  /** The person mask runs from the walk to the end of the message (research-android D2). */
  mask: { start: 4.2, end: 25.4 },
  total: 26.8,
} as const;

/** Progress of a window at time t, clamped to [0, 1]. */
export function windowProgress(t: number, w: PhaseWindow): number {
  'worklet';
  if (w.end <= w.start) {
    return t >= w.end ? 1 : 0;
  }
  const p = (t - w.start) / (w.end - w.start);
  return p < 0 ? 0 : p > 1 ? 1 : p;
}

/** True while t is inside the window (start inclusive, end exclusive). */
export function inWindow(t: number, w: PhaseWindow): boolean {
  'worklet';
  return t >= w.start && t < w.end;
}

/**
 * The dominant phase at time t (for logic and labels): the latest phase that has started.
 * t < 0 means no visit is running.
 */
export function phaseAt(t: number): Phase {
  'worklet';
  if (t < 0 || t >= TIMELINE.total) {
    return 'idle';
  }
  if (t >= TIMELINE.return.start) return 'return';
  if (t >= TIMELINE.message.start) return 'message';
  if (t >= TIMELINE.reveal.start) return 'reveal';
  if (t >= TIMELINE.arrive.start) return 'arrive';
  if (t >= TIMELINE.walk.start) return 'walk';
  if (t >= TIMELINE.gather.start) return 'gather';
  if (t >= TIMELINE.path.start) return 'path';
  return 'shrink';
}
