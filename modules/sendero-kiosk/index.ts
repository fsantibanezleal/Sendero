import SenderoKiosk from './src/SenderoKioskModule';

export type { KioskState, SenderoKioskNative } from './src/SenderoKioskModule';

/** JS surface of the native kiosk module (contract version 1). */
export const isDeviceOwner = (): boolean => SenderoKiosk.isDeviceOwner();
export const kioskState = () => SenderoKiosk.kioskState();
export const enterKiosk = () => SenderoKiosk.enterKiosk();
export const exitKiosk = (): Promise<void> => SenderoKiosk.exitKiosk();
export const releaseDeviceOwner = (): Promise<void> => SenderoKiosk.releaseDeviceOwner();
export const externalMusicDirectory = (): string => SenderoKiosk.externalMusicDirectory();
export const setKioskEnabled = (enabled: boolean): void => SenderoKiosk.setKioskEnabled(enabled);
export const isKioskEnabled = (): boolean => SenderoKiosk.isKioskEnabled();

export default SenderoKiosk;
