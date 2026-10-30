/**
 * The experience state machine (plans/sendero plan.md section 3).
 *
 * One clock drives every visual: `clock` (seconds since the visitor's touch, -1 while idle) and
 * `time` (seconds since the app started, for idle animations) advance on the UI thread with
 * Reanimated's frame callback, so animation never waits for JavaScript.
 *
 * The next visit is planned while the altar waits (the companion, the gathering, the message and
 * the petal path), so its layers are already mounted, invisible, when the visitor touches: the touch
 * only starts the clock, on the UI thread (`begin`), and nothing the visitor sees depends on a React
 * render at that moment. The side effects that are not visual (camera mask on and off, music
 * ducking, the whisper) follow the clock: a reaction on the UI thread reports each mark of the
 * timeline to the JS thread as the clock passes it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { type SharedValue, useAnimatedReaction, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { MESSAGES } from '../content/messages';
import { log } from '../diagnostics/log';
import { describeLook, describePet } from '../figures/looks';
import { emptyHistory, type History, LAST_STAGE, MARK_NAMES, planVisit, stageAt, type Visit } from './plan';
import { TIMELINE } from './timeline';

export type { Visit };

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
  /** The visit the next touch starts: its path and family are mounted, hidden, ahead of the touch. */
  visit: Visit;
  /** The visit on screen: its farewell, message and voice. */
  shown: Visit;
  /**
   * Starts the planned visit from a UI-thread worklet (the touch gesture); returns false while a
   * visit runs or the next one is still being prepared (the touch is ignored).
   */
  begin(): boolean;
  /** The same from the JS thread (the staff panel's test visit). */
  start(): boolean;
}

export function useExperience(events: ExperienceEvents): Experience {
  const clock = useSharedValue(-1);
  const time = useSharedValue(0);
  /** True once the planned visit's layers are mounted. */
  const ready = useSharedValue(false);
  const [first] = useState(() => {
    const h: History = emptyHistory();
    return { history: h, visit: planVisit(h) };
  });
  const history = useRef<History>(first.history);
  // Two visits: the one the next touch starts (path, family, walk) and the one on screen (farewell,
  // message, voice). The next one is planned when the farewell begins, while its layers are hidden, so a
  // touch is accepted the moment a visit ends (planning at the end left the altar deaf for seconds).
  const [visit, setVisit] = useState<Visit>(first.visit);
  const [shown, setShown] = useState<Visit>(first.visit);
  const visitRef = useRef(first.visit);
  const shownRef = useRef(first.visit);
  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    // Effects run after the commit: the planned visit's path and figures are mounted now. A touch may
    // start it as soon as no visit is running.
    visitRef.current = visit;
    if (clock.get() < 0) ready.set(true);
  }, [visit, ready, clock]);

  useFrameCallback((frame) => {
    'worklet';
    // Real time, whatever the frame rate: a slow device shows fewer frames, never a longer visit (with
    // steps capped at 0.1 s a tablet at 3 frames per second stretched the 27 s visit past a minute,
    // and touches during that long fade back to the camera were ignored). Only a gap of over half a
    // second (the app paused) is cut short.
    const dt = Math.min(0.5, (frame.timeSincePreviousFrame ?? 16) / 1000);
    time.value = time.value + dt;
    if (clock.value >= 0) {
      const next = clock.value + dt;
      clock.value = next >= TIMELINE.total ? -1 : next;
    }
  });

  const fire = useCallback((stage: number, v: Visit) => {
    const e = eventsRef.current;
    log(`visit ${v.id}: ${MARK_NAMES[stage - 1]}`);
    switch (stage) {
      case 1:
        e.onMask(true);
        break;
      case 2:
        e.onReveal(v);
        break;
      case 3:
        e.onMessage(v);
        break;
      case 4:
        e.onWhisper(v);
        break;
      case 5:
        e.onReturn(v);
        e.onMask(false);
        break;
    }
  }, []);

  const onStage = useCallback(
    (current: number, previous: number) => {
      if (previous < 0 && current >= 0) {
        // The touch started the planned visit: it becomes the one on screen.
        const started = visitRef.current;
        shownRef.current = started;
        setShown(started);
        log(`visit ${started.id} started: ${describeLook(started.people[started.walker])}${started.companion != null ? ` with ${describePet(started.pets[started.companion])}` : ''}, message ${MESSAGES[started.messageIndex].id}`);
      }
      const v = shownRef.current;
      if (current >= 0) {
        for (let k = Math.max(previous, 0) + 1; k <= current; k++) fire(k, v);
        if (previous < 2 && current >= 2) {
          // The walk is over and its layers are hidden: plan the next visit now.
          setVisit(planVisit(history.current));
        }
        return;
      }
      // The visit ended. The mask and the music are always released, even if a mark was missed.
      if (previous < LAST_STAGE) fire(LAST_STAGE, v);
      log(`visit ${v.id} ended`);
      eventsRef.current.onEnd();
      if (previous < 2) setVisit(planVisit(history.current));
      // The next visit is ready when its layers are mounted (else the effect above opens the altar).
      if (visitRef.current.id !== v.id) ready.set(true);
    },
    [fire],
  );

  useAnimatedReaction(
    () => stageAt(clock.value),
    (current, previous) => {
      if (previous == null || current === previous) return;
      scheduleOnRN(onStage, current, previous);
    },
  );

  const begin = useCallback((): boolean => {
    'worklet';
    if (clock.get() >= 0 || !ready.get()) return false;
    ready.set(false);
    clock.set(0);
    return true;
  }, [clock, ready]);

  const start = useCallback((): boolean => {
    if (clock.get() >= 0 || !ready.get()) return false;
    ready.set(false);
    clock.set(0);
    return true;
  }, [clock, ready]);

  return { clock, time, visit, shown, begin, start };
}
