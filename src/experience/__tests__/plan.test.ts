import { MESSAGES } from '../../content/messages';
import { HUMAN_PROFILE, HUMANS } from '../../figures/catalog';
import { mulberry32 } from '../../procedural';
import { type History, LAST_STAGE, MARKS, planVisit, stageAt } from '../plan';
import { TIMELINE } from '../timeline';

describe('timeline stages', () => {
  it('is -1 while idle and counts the marks the clock has passed', () => {
    expect(stageAt(-1)).toBe(-1);
    expect(stageAt(0)).toBe(0);
    expect(stageAt(TIMELINE.mask.start - 0.01)).toBe(0);
    expect(stageAt(TIMELINE.mask.start)).toBe(1);
    expect(stageAt(TIMELINE.reveal.start)).toBe(2);
    expect(stageAt(TIMELINE.message.start)).toBe(3);
    expect(stageAt(TIMELINE.whisperAt)).toBe(4);
    expect(stageAt(TIMELINE.return.start)).toBe(LAST_STAGE);
    expect(stageAt(TIMELINE.total - 0.01)).toBe(LAST_STAGE);
  });

  it('has its marks in order and inside the visit', () => {
    for (let i = 1; i < MARKS.length; i++) {
      expect(MARKS[i]).toBeGreaterThan(MARKS[i - 1]);
    }
    expect(MARKS[0]).toBeGreaterThan(0);
    expect(MARKS[MARKS.length - 1]).toBeLessThan(TIMELINE.total);
  });

  it('never decreases while the clock runs, at any frame rate', () => {
    for (const dt of [1 / 120, 1 / 60, 1 / 24, 0.1]) {
      let last = stageAt(0);
      for (let t = 0; t < TIMELINE.total; t += dt) {
        const s = stageAt(t);
        expect(s).toBeGreaterThanOrEqual(last);
        last = s;
      }
      expect(last).toBe(LAST_STAGE);
    }
  });
});

describe('planning the next visit', () => {
  it('numbers the visits and never repeats the previous person or message', () => {
    const h: History = { human: null, message: null, count: 0 };
    const rand = mulberry32(7);
    let previous = planVisit(h, rand);
    expect(previous.id).toBe(1);
    for (let i = 2; i <= 500; i++) {
      const v = planVisit(h, rand);
      expect(v.id).toBe(i);
      expect(v.group.human).not.toBe(previous.group.human);
      expect(v.messageIndex).not.toBe(previous.messageIndex);
      previous = v;
    }
  });

  it('plans a complete visit: grown-ups only, the chosen group first, the voice of the person', () => {
    const h: History = { human: null, message: null, count: 0 };
    const rand = mulberry32(11);
    for (let i = 0; i < 300; i++) {
      const v = planVisit(h, rand);
      expect(HUMANS).toContain(v.group.human);
      expect(v.gather[0]).toBe(v.group);
      expect(v.gather.length).toBeGreaterThanOrEqual(3);
      for (const g of v.gather) expect(HUMANS).toContain(g.human);
      expect(v.voice).toBe(HUMAN_PROFILE[v.group.human].voice);
      expect(v.messageIndex).toBeGreaterThanOrEqual(0);
      expect(v.messageIndex).toBeLessThan(MESSAGES.length);
      expect(Number.isInteger(v.pathSeed)).toBe(true);
      expect(v.pathSeed).toBeGreaterThanOrEqual(0);
      expect(v.pathSeed).toBeLessThan(2 ** 31);
    }
  });
});
