/**
 * Hidden staff gesture: five taps within 3000 ms, each inside the upper-left corner square whose
 * side is 12 percent of the smaller screen side. A tap outside the square, a first-to-fifth gap
 * over 3000 ms or a clock that goes backwards restarts the count.
 */

export const GESTURE_TAPS = 5;
export const GESTURE_WINDOW_MS = 3000;
export const CORNER_FRACTION = 0.12;

export interface StaffGestureOptions {
  width: number;
  height: number;
  /** Clock in milliseconds; injectable for tests. */
  now?: () => number;
}

export interface StaffGesture {
  /** Registers a tap; true exactly on the fifth qualifying tap. */
  tap(x: number, y: number): boolean;
  reset(): void;
}

export function createStaffGesture({ width, height, now = Date.now }: StaffGestureOptions): StaffGesture {
  const side = Math.min(width, height) * CORNER_FRACTION;
  let times: number[] = [];

  const reset = () => {
    times = [];
  };

  const tap = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x > side || y > side) {
      reset();
      return false;
    }
    const t = now();
    const last = times.length > 0 ? times[times.length - 1] : undefined;
    if (last !== undefined && t < last) reset();
    times.push(t);
    // Drop taps that are too old to belong to a five-tap window ending now.
    while (times.length > 0 && t - times[0] > GESTURE_WINDOW_MS) times.shift();
    if (times.length >= GESTURE_TAPS) {
      reset();
      return true;
    }
    return false;
  };

  return { tap, reset };
}
