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

function beat(sentAt: number) {
  log(`threads: ${Date.now() - sentAt} ms from the UI thread to the JS thread`);
}

export function useExperience(events: ExperienceEvents): Experience {
  const clock = useSharedValue(-1);
  const time = useSharedValue(0);
  /**
   * The id of the planned visit whose layers are mounted, and of the last visit started. A touch starts a visit only
   * when the mounted one is newer: no flag to set and clear in the right order (that order failed on the tablet and
   * left the altar deaf after the first visit).
   */
  const mounted = useSharedValue(0);
  const started = useSharedValue(0);
  /** A touch arrived while the next visit was being prepared. */
  const pending = useSharedValue(false);
  /** Frame timestamp (ms) at which the running visit started; -1 until its first frame. */
  const startedAt = useSharedValue(-1);
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
  const plannedAt = useRef(0);
  const shownRef = useRef(first.visit);
  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    // Effects run after the commit: the planned visit's path and figures are mounted now. A touch may
    // start it as soon as no visit is running.
    visitRef.current = visit;
    mounted.set(visit.id);
    log(`visit ${visit.id} ready${plannedAt.current > 0 ? ` (${Date.now() - plannedAt.current} ms to plan and draw)` : ''}`);
  }, [visit, mounted]);

  useFrameCallback((frame) => {
    'worklet';
    // Real time, whatever the frame rate: a slow device shows fewer frames, never a longer visit (with
    // steps capped at 0.1 s a tablet at 3 frames per second stretched the 27 s visit past a minute,
    // and touches during that long fade back to the camera were ignored). Only a gap of over half a
    // second (the app paused) is cut short.
    const dt = Math.min(0.5, (frame.timeSincePreviousFrame ?? 16) / 1000);
    time.value = time.value + dt;
    // Diagnostic: how late the UI thread's messages reach the JS thread (it reached 20 s on the TCL tablet).
    const g = globalThis as unknown as { __senderoBeat?: number };
    if (g.__senderoBeat == null || Date.now() - g.__senderoBeat > 10000) {
      g.__senderoBeat = Date.now();
      scheduleOnRN(beat, g.__senderoBeat);
    }
    if (clock.get() >= 0) {
      // The visit's clock is read from the frame's timestamp, not summed from steps: a visit lasts its
      // 26.8 s of real time even when frames come seconds apart (a loaded device ran one for 90 s).
      if (startedAt.get() < 0) startedAt.set(frame.timestamp - clock.get() * 1000);
      const next = (frame.timestamp - startedAt.get()) / 1000;
      clock.set(next >= TIMELINE.total ? -1 : next);
    } else if (pending.get() && mounted.get() > started.get()) {
      // A touch that came while the next visit was being prepared starts it now.
      pending.set(false);
      started.set(mounted.get());
      startedAt.set(-1);
      clock.set(0);
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

  const safeFire = useCallback(
    (stage: number, v: Visit) => {
      try {
        fire(stage, v);
      } catch (e) {
        log(`visit ${v.id}: ${MARK_NAMES[stage - 1]} failed: ${String(e)}`);
      }
    },
    [fire],
  );

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
        for (let k = Math.max(previous, 0) + 1; k <= current; k++) safeFire(k, v);
        if (previous < 4 && current >= 4) {
          // The voice is playing: plan the next visit now. Drawing its figures keeps this thread busy for a moment,
          // which delayed the voice by seconds when it was done at the reveal on the tablet.
          plannedAt.current = Date.now();
          setVisit(planVisit(history.current));
        }
        return;
      }
      // The visit ended. The mask and the music are always released, even if a mark was missed.
      if (previous < LAST_STAGE) safeFire(LAST_STAGE, v);
      log(`visit ${v.id} ended`);
      try {
        eventsRef.current.onEnd();
      } catch (e) {
        log(`visit ${v.id}: end failed: ${String(e)}`);
      }
      if (visitRef.current.id === v.id) {
        // No next visit yet: plan it; a touch starts it once its layers are mounted.
        setVisit(planVisit(history.current));
      }
    },
    [safeFire],
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
    if (clock.get() >= 0) return false;
    if (mounted.get() <= started.get()) {
      // Remembered: the frame callback starts the visit as soon as it is mounted.
      pending.set(true);
      return false;
    }
    started.set(mounted.get());
    startedAt.set(-1);
    clock.set(0);
    return true;
  }, [clock, mounted, started, pending, startedAt]);

  const start = useCallback((): boolean => {
    if (clock.get() >= 0) return false;
    if (mounted.get() <= started.get()) {
      // Remembered: the frame callback starts the visit as soon as it is mounted.
      pending.set(true);
      return false;
    }
    started.set(mounted.get());
    startedAt.set(-1);
    clock.set(0);
    return true;
  }, [clock, mounted, started, pending, startedAt]);

  return { clock, time, visit, shown, begin, start };
}
