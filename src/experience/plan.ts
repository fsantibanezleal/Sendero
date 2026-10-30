/**
 * The pure parts of a visit (plans/sendero plan.md section 3): choosing the next visit while the
 * altar waits, and the marks of the timeline that carry side effects. No React, no native runtime,
 * so they are tested directly.
 */
import { MESSAGES } from '../content/messages';
import { chooseGroup, chooseMessage, type CompanionGroup, gatherGroups, HUMAN_PROFILE, type HumanKind, type VoiceId } from '../figures/catalog';
import { TIMELINE } from './timeline';

export interface Visit {
  id: number;
  group: CompanionGroup;
  gather: CompanionGroup[];
  messageIndex: number;
  voice: VoiceId;
  /** Seed of this visit's petal path, so every visit draws a different path. */
  pathSeed: number;
}

/** The marks of the timeline that have side effects, in order (stage k = marks 1..k passed). */
export const MARKS = [TIMELINE.mask.start, TIMELINE.reveal.start, TIMELINE.message.start, TIMELINE.whisperAt, TIMELINE.return.start] as const;
export const MARK_NAMES = ['mask on', 'reveal', 'message', 'whisper', 'return'] as const;
export const LAST_STAGE = MARKS.length;

/** -1 while idle; otherwise the number of marks the clock has passed. */
export function stageAt(t: number): number {
  'worklet';
  if (t < 0) return -1;
  let n = 0;
  for (let i = 0; i < MARKS.length; i++) {
    if (t >= MARKS[i]) n = i + 1;
  }
  return n;
}

export interface History {
  human: HumanKind | null;
  message: number | null;
  count: number;
}

/** Chooses the next visit, avoiding the previous companion and the previous message. */
export function planVisit(h: History, random: () => number = Math.random): Visit {
  const group = chooseGroup(random, h.human);
  const messageIndex = chooseMessage(random, MESSAGES.length, h.message);
  h.human = group.human;
  h.message = messageIndex;
  h.count += 1;
  return {
    id: h.count,
    group,
    gather: gatherGroups(random, group),
    messageIndex,
    voice: HUMAN_PROFILE[group.human].voice,
    pathSeed: Math.floor(random() * 2 ** 31),
  };
}
