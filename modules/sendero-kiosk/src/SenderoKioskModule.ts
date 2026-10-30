import { requireNativeModule } from 'expo-modules-core';

export type KioskState = 'locked' | 'pinned' | 'off';

/** Shape of the native module (SenderoKioskModule.kt); keep in exact sync. */
export interface SenderoKioskNative {
  isDeviceOwner(): boolean;
  kioskState(): KioskState;
  enterKiosk(): Promise<'locked' | 'pinned'>;
  exitKiosk(): Promise<void>;
  releaseDeviceOwner(): Promise<void>;
  externalMusicDirectory(): string;
  setKioskEnabled(enabled: boolean): void;
  isKioskEnabled(): boolean;
}

export default requireNativeModule<SenderoKioskNative>('SenderoKiosk');
