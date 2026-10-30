import { requireOptionalNativeModule } from 'expo-modules-core';

import type { KioskState, SenderoKioskNative } from '../../modules/sendero-kiosk/src/SenderoKioskModule';

/**
 * Kiosk API of the app. Wraps the native module SenderoKiosk with requireOptionalNativeModule, so
 * Jest and a build without the module degrade to 'off' and no-ops instead of crashing at import.
 */

export type { KioskState };

const native = requireOptionalNativeModule<SenderoKioskNative>('SenderoKiosk');

export const isDeviceOwner = (): boolean => native?.isDeviceOwner() ?? false;

export const kioskState = (): KioskState => native?.kioskState() ?? 'off';

export async function enterKiosk(): Promise<'locked' | 'pinned'> {
  if (!native) throw new Error('kiosk module unavailable');
  return native.enterKiosk();
}

export async function exitKiosk(): Promise<void> {
  await native?.exitKiosk();
}

export async function releaseDeviceOwner(): Promise<void> {
  await native?.releaseDeviceOwner();
}

export const externalMusicDirectory = (): string => native?.externalMusicDirectory() ?? '';

export const setKioskEnabled = (enabled: boolean): void => {
  native?.setKioskEnabled(enabled);
};

export const isKioskEnabled = (): boolean => native?.isKioskEnabled() ?? false;
