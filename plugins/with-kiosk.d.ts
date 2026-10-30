import type { ConfigPlugin } from 'expo/config-plugins';

/** Adds the HOME intent filter and android:lockTaskMode to MainActivity; idempotent. */
export declare function addKioskToManifest<T>(manifest: T): T;

declare const withKiosk: ConfigPlugin;
export default withKiosk;
