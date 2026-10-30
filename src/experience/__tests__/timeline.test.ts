import { computeLayout, frameTransform } from '../layout';
import { inWindow, phaseAt, TIMELINE, windowProgress } from '../timeline';

describe('timeline', () => {
  it('walks for about seven seconds and returns about ten seconds after the message', () => {
    expect(TIMELINE.walk.end - TIMELINE.walk.start).toBeCloseTo(7.0, 5);
    expect(TIMELINE.message.end - TIMELINE.message.start).toBeCloseTo(10.0, 5);
    expect(TIMELINE.return.end).toBe(TIMELINE.total);
  });

  it('orders the phases', () => {
    expect(phaseAt(-1)).toBe('idle');
    expect(phaseAt(0)).toBe('shrink');
    expect(phaseAt(1.0)).toBe('path');
    expect(phaseAt(3.0)).toBe('gather');
    expect(phaseAt(5)).toBe('walk');
    expect(phaseAt(11.5)).toBe('arrive');
    expect(phaseAt(13)).toBe('reveal');
    expect(phaseAt(16)).toBe('message');
    expect(phaseAt(26)).toBe('return');
    expect(phaseAt(TIMELINE.total)).toBe('idle');
  });

  it('clamps window progress and handles empty windows', () => {
    expect(windowProgress(-5, TIMELINE.walk)).toBe(0);
    expect(windowProgress(7.7, TIMELINE.walk)).toBeCloseTo(0.5, 5);
    expect(windowProgress(99, TIMELINE.walk)).toBe(1);
    expect(windowProgress(1, { start: 2, end: 2 })).toBe(0);
    expect(windowProgress(2, { start: 2, end: 2 })).toBe(1);
    expect(inWindow(TIMELINE.mask.start, TIMELINE.mask)).toBe(true);
    expect(inWindow(TIMELINE.mask.end, TIMELINE.mask)).toBe(false);
  });

  it('whispers inside the message window', () => {
    expect(inWindow(TIMELINE.whisperAt, TIMELINE.message)).toBe(true);
  });
});

describe('layout', () => {
  const layout = computeLayout(1600, 1000);

  it('puts the mini frame inside the lower right corner', () => {
    const { mini } = layout;
    expect(mini.x + mini.width).toBeLessThanOrEqual(1600);
    expect(mini.y + mini.height).toBeLessThanOrEqual(1000);
    expect(mini.x).toBeGreaterThan(800);
    expect(mini.y).toBeGreaterThan(500);
    expect(mini.width / mini.height).toBeCloseTo(1.6, 5);
  });

  it('starts the path at the upper left and ends it at the mini frame', () => {
    expect(layout.pathStart.x).toBeLessThan(0.2 * 1600);
    expect(layout.pathStart.y).toBeLessThan(0.25 * 1000);
    expect(layout.pathEnd.x).toBeGreaterThanOrEqual(layout.mini.x);
    expect(layout.pathEnd.y).toBeGreaterThan(layout.mini.y);
  });

  it('maps the frame transform from full screen (k = 0) to the mini frame (k = 1)', () => {
    expect(frameTransform(layout, 0)).toEqual({ tx: 0, ty: 0, s: 1 });
    const end = frameTransform(layout, 1);
    expect(end.s).toBeCloseTo(layout.miniScale, 6);
    expect(end.tx).toBeCloseTo(layout.mini.x, 6);
    expect(end.ty).toBeCloseTo(layout.mini.y, 6);
    // The scaled screen corner lands on the mini frame corner.
    expect(end.tx + 1600 * end.s).toBeCloseTo(layout.mini.x + layout.mini.width, 6);
  });
});
