import { Group, Skia } from '@shopify/react-native-skia';
import type { ReactNode } from 'react';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';

/**
 * Draws its children only while `on` is true. React Native Skia replays every mounted node on every
 * frame, and an opacity of 0 still draws (its player has no shortcut for it), so a hidden layer would
 * cost as much as a visible one; an empty clip instead lets Skia reject every draw inside, including
 * the offscreen layers of blurs and blend groups. The children stay mounted, so showing them again
 * needs no React render.
 */
export function Gate({ on, width, height, children }: { on: SharedValue<boolean>; width: number; height: number; children: ReactNode }) {
  const clip = useDerivedValue(() => (on.value ? Skia.XYWHRect(0, 0, width, height) : Skia.XYWHRect(0, 0, 0, 0)));
  return <Group clip={clip}>{children}</Group>;
}
