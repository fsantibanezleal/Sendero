import { StyleSheet, Text, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { displayText, MESSAGES } from '../content/messages';
import type { Visit } from '../experience/useExperience';
import { TIMELINE } from '../experience/timeline';
import { smoothstep } from '../procedural';
import { palette } from '../theme/palette';

export const FONT_MESSAGE = 'CormorantGaramond-MediumItalic';
export const FONT_TITLE = 'CormorantGaramond-SemiBold';

/**
 * The remembrance message: an indigo veil covers the screen and one message appears in large warm
 * type (16.9:1 contrast on the veil, research-visuals D6). It stays for ten seconds and fades with
 * the return.
 */
export function MessageOverlay({ visit, clock }: { visit: Visit | null; clock: SharedValue<number> }) {
  const veil = useAnimatedStyle(() => {
    const t = clock.value;
    const on = smoothstep(TIMELINE.message.start, TIMELINE.message.start + 1.2, t);
    const off = 1 - smoothstep(TIMELINE.return.start, TIMELINE.return.end, t);
    return { opacity: t < 0 ? 0 : on * off * 0.86 };
  });
  const words = useAnimatedStyle(() => {
    const t = clock.value;
    const on = smoothstep(TIMELINE.message.start + 0.6, TIMELINE.message.start + 2.2, t);
    const off = 1 - smoothstep(TIMELINE.return.start, TIMELINE.return.end - 0.4, t);
    const a = t < 0 ? 0 : on * off;
    return { opacity: a, transform: [{ translateY: (1 - on) * 12 }] };
  });
  const text = visit == null ? '' : displayText(MESSAGES[visit.messageIndex]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.veil, veil]} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, words]}>
        <Text style={styles.message} adjustsFontSizeToFit numberOfLines={2}>
          {text}
        </Text>
      </Animated.View>
    </View>
  );
}

/** The gentle invitation while waiting: it breathes slowly and disappears during a visit. */
export function Hint({ clock, time, visible }: { clock: SharedValue<number>; time: SharedValue<number>; visible: boolean }) {
  const style = useAnimatedStyle(() => {
    const idle = clock.value < 0 ? 1 : 0;
    return { opacity: visible ? idle * (0.45 + 0.35 * Math.sin(time.value * 1.1)) : 0 };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.hintBox, style]}>
      <Text style={styles.hint}>Toca la pantalla</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  veil: { backgroundColor: palette.night },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: '8%' },
  message: {
    fontFamily: FONT_MESSAGE,
    fontSize: 84,
    lineHeight: 96,
    color: palette.warmWhite,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 194, 14, 0.45)',
    textShadowRadius: 18,
  },
  hintBox: { position: 'absolute', left: 0, right: 0, bottom: '15%', alignItems: 'center' },
  hint: {
    fontFamily: FONT_TITLE,
    fontSize: 30,
    letterSpacing: 2,
    color: palette.warmWhite,
    textShadowColor: 'rgba(20, 16, 43, 0.9)',
    textShadowRadius: 10,
  },
});
