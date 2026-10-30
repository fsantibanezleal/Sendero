/**
 * The experience state machine (plans/sendero plan.md section 3).
 *
 * One clock drives every visual: `clock` (seconds since the visitor's touch, -1 while idle) and
 * `time` (seconds since the app started, for idle animations) advance on the UI thread with
 * Reanimated's frame callback, so animation never waits for JavaScript. Side effects that are not
 * visual (camera mask on and off, music ducking, the whisper) run on the JS thread from timers set
 * at the touch, at the times of the timeline.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { type SharedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';

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

export interface ExperienceEvents {
  /** The person mask is needed from the walk to the end of the message. */
  onMask(active: boolean): void;
  /** The frame is full screen again: the reveal begins. */
  onReveal(visit: Visit): void;
  onMessage(visit: Visit): void;
  onWhisper(visit: Visit): void;
  onReturn(visit: Visit): void;
  onEnd(): void;
}

export interface Experience {
  clock: SharedValue<number>;
  time: SharedValue<number>;
  visit: Visit | null;
  /** Starts a visit; returns false while one is running (touches are ignored). */
  start(): boolean;
}

export function useExperience(events: ExperienceEvents): Experience {
  const clock = useSharedValue(-1);
  const time = useSharedValue(0);
  const [visit, setVisit] = useState<Visit | null>(null);
  const running = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const history = useRef<{ human: HumanKind | null; message: number | null; count: number }>({
    human: null,
    message: null,
    count: 0,
  });
  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useFrameCallback((frame) => {
    'worklet';
    const dt = Math.min(0.1, (frame.timeSincePreviousFrame ?? 16) / 1000);
    time.value = time.value + dt;
    if (clock.value >= 0) {
      const next = clock.value + dt;
      clock.value = next >= TIMELINE.total ? -1 : next;
    }
  });

  useEffect(
    () => () => {
      for (const t of timers.current) clearTimeout(t);
    },
    [],
  );

  const start = useCallback((): boolean => {
    if (running.current) {
      return false;
    }
    running.current = true;
    const h = history.current;
    const group = chooseGroup(Math.random, h.human);
    const messageIndex = chooseMessage(Math.random, MESSAGES.length, h.message);
    h.human = group.human;
    h.message = messageIndex;
    h.count += 1;
    const v: Visit = {
      id: h.count,
      group,
      gather: gatherGroups(Math.random, group),
      messageIndex,
      voice: HUMAN_PROFILE[group.human].voice,
      pathSeed: Math.floor(Math.random() * 2 ** 31),
    };
    setVisit(v);
    clock.value = 0;

    const at = (seconds: number, fn: () => void) => {
      timers.current.push(setTimeout(fn, seconds * 1000));
    };
    at(TIMELINE.mask.start, () => eventsRef.current.onMask(true));
    at(TIMELINE.reveal.start, () => eventsRef.current.onReveal(v));
    at(TIMELINE.message.start, () => eventsRef.current.onMessage(v));
    at(TIMELINE.whisperAt, () => eventsRef.current.onWhisper(v));
    at(TIMELINE.return.start, () => {
      eventsRef.current.onReturn(v);
      eventsRef.current.onMask(false);
    });
    at(TIMELINE.total, () => {
      clock.value = -1;
      running.current = false;
      timers.current = [];
      setVisit(null);
      eventsRef.current.onEnd();
    });
    return true;
  }, [clock]);

  return { clock, time, visit, start };
}
