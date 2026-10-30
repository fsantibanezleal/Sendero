import { createStaffGesture } from '../staffGesture';

// Screen 1000 x 600: the corner square side is 12 percent of min(1000, 600) = 72.
const SIZE = { width: 1000, height: 600 };

function setup() {
  let t = 0;
  const gesture = createStaffGesture({ ...SIZE, now: () => t });
  return {
    gesture,
    at: (ms: number) => {
      t = ms;
    },
  };
}

describe('staff gesture', () => {
  it('fires exactly on the fifth quick tap in the corner', () => {
    const { gesture, at } = setup();
    const results: boolean[] = [];
    for (let i = 0; i < 5; i += 1) {
      at(i * 500);
      results.push(gesture.tap(10, 10));
    }
    expect(results).toEqual([false, false, false, false, true]);
  });

  it('does not fire on four taps', () => {
    const { gesture, at } = setup();
    let fired = false;
    for (let i = 0; i < 4; i += 1) {
      at(i * 100);
      fired = gesture.tap(10, 10) || fired;
    }
    expect(fired).toBe(false);
  });

  it('resets on a tap outside the square', () => {
    const { gesture, at } = setup();
    for (let i = 0; i < 3; i += 1) {
      at(i * 100);
      gesture.tap(10, 10);
    }
    at(300);
    expect(gesture.tap(500, 300)).toBe(false);
    for (let i = 0; i < 4; i += 1) {
      at(400 + i * 100);
      expect(gesture.tap(10, 10)).toBe(false);
    }
    at(900);
    expect(gesture.tap(10, 10)).toBe(true);
  });

  it('does not fire when five taps spread over more than 3 s', () => {
    const { gesture, at } = setup();
    let fired = false;
    for (let i = 0; i < 5; i += 1) {
      at(i * 800); // first to fifth: 3200 ms
      fired = gesture.tap(10, 10) || fired;
    }
    expect(fired).toBe(false);
  });

  it('fires when the first to fifth gap is exactly 3000 ms', () => {
    const { gesture, at } = setup();
    const times = [0, 700, 1500, 2200, 3000];
    let last = false;
    for (const ms of times) {
      at(ms);
      last = gesture.tap(1, 1);
    }
    expect(last).toBe(true);
  });

  it('counts taps exactly on the square edge and rejects just outside', () => {
    const { gesture, at } = setup();
    for (let i = 0; i < 4; i += 1) {
      at(i * 100);
      expect(gesture.tap(72, 72)).toBe(false);
    }
    at(500);
    expect(gesture.tap(72, 72)).toBe(true);

    const other = setup();
    other.at(0);
    other.gesture.tap(10, 10);
    other.at(10);
    expect(other.gesture.tap(72.5, 10)).toBe(false);
    other.at(20);
    expect(other.gesture.tap(10, 72.5)).toBe(false);
  });

  it('uses the smaller screen side for the square', () => {
    const portrait = createStaffGesture({ width: 600, height: 1000, now: () => 0 });
    // 73 is outside a 72 square, so the count restarts; four taps inside still do not fire.
    portrait.tap(73, 10);
    for (let i = 0; i < 4; i += 1) expect(portrait.tap(5, 5)).toBe(false);
    expect(portrait.tap(72, 72)).toBe(true);
  });

  it('treats a clock that goes backwards as a reset', () => {
    const { gesture, at } = setup();
    for (let i = 0; i < 3; i += 1) {
      at(1000 + i * 100);
      gesture.tap(10, 10);
    }
    at(500); // the clock went backwards: the count restarts with this tap
    expect(gesture.tap(10, 10)).toBe(false);
    for (let i = 1; i < 4; i += 1) {
      at(500 + i * 100);
      expect(gesture.tap(10, 10)).toBe(false);
    }
    at(900);
    expect(gesture.tap(10, 10)).toBe(true);
  });

  it('restarts the count after firing and after reset()', () => {
    const { gesture, at } = setup();
    for (let i = 0; i < 5; i += 1) {
      at(i * 10);
      gesture.tap(1, 1);
    }
    at(100);
    expect(gesture.tap(1, 1)).toBe(false);
    gesture.reset();
    for (let i = 0; i < 4; i += 1) {
      at(200 + i * 10);
      expect(gesture.tap(1, 1)).toBe(false);
    }
    at(300);
    expect(gesture.tap(1, 1)).toBe(true);
  });
});
