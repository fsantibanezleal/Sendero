import { MESSAGES } from '../../content/messages';
import { HUMAN_PROFILE, HUMANS } from '../../figures/catalog';
import { mulberry32 } from '../../procedural';
import { emptyHistory, type History, LAST_STAGE, MARKS, planVisit, stageAt } from '../plan';
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
  it('numbers the visits; never the same person walks twice in a row; no message repeats within a round', () => {
    const h: History = emptyHistory();
    const rand = mulberry32(7);
    let previous = planVisit(h, rand);
    expect(previous.id).toBe(1);
    const roundSeen = new Set<number>([previous.messageIndex]);
    for (let i = 2; i <= 500; i++) {
      const v = planVisit(h, rand);
      expect(v.id).toBe(i);
      expect(v.people[v.walker].human).not.toBe(previous.people[previous.walker].human);
      expect(v.messageIndex).not.toBe(previous.messageIndex);
      if (roundSeen.size === MESSAGES.length) roundSeen.clear();
      expect(roundSeen.has(v.messageIndex)).toBe(false);
      roundSeen.add(v.messageIndex);
      previous = v;
    }
  });

  it('always has the four people and the two pets, a person walks, a pet only beside them', () => {
    const h: History = emptyHistory();
    const rand = mulberry32(11);
    let withPet = 0;
    for (let i = 0; i < 300; i++) {
      const v = planVisit(h, rand);
      expect(v.people.map((p) => p.human)).toEqual([...HUMANS]);
      expect(v.pets.map((p) => p.kind)).toEqual(['perro', 'gato']);
      expect(v.walker).toBeGreaterThanOrEqual(0);
      expect(v.walker).toBeLessThan(4);
      if (v.companion != null) {
        withPet++;
        expect([0, 1]).toContain(v.companion);
      }
      expect([...v.spots].sort()).toEqual([0, 1, 2, 3, 4, 5]);
      expect(v.spots.slice(0, 4).every((s) => s < 4)).toBe(true);
      expect(v.voice).toBe(HUMAN_PROFILE[v.people[v.walker].human].voice);
      expect(Number.isInteger(v.pathSeed)).toBe(true);
      expect(v.pathSeed).toBeGreaterThanOrEqual(0);
      expect(v.pathSeed).toBeLessThan(2 ** 31);
    }
    expect(withPet).toBeGreaterThan(60);
    expect(withPet).toBeLessThan(150);
  });

  it('draws new variants at every visit', () => {
    const h: History = emptyHistory();
    const rand = mulberry32(13);
    const a = planVisit(h, rand);
    const b = planVisit(h, rand);
    for (let i = 0; i < 4; i++) expect(JSON.stringify(a.people[i])).not.toBe(JSON.stringify(b.people[i]));
    for (let i = 0; i < 2; i++) expect(JSON.stringify(a.pets[i])).not.toBe(JSON.stringify(b.pets[i]));
  });
});
