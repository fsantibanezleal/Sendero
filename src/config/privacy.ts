/**
 * Privacy rule of the build: the kiosk app never needs the network, so every build blocks the
 * INTERNET permission unless a developer explicitly opts in for a Metro debug session.
 *
 * Kept free of Expo imports so the rule is unit-tested in isolation (see __tests__/privacy.test.ts).
 */

export const INTERNET_PERMISSION = 'android.permission.INTERNET';

/** Environment variable that keeps the network permission for a debug session with Metro. */
export const DEV_NETWORK_FLAG = 'SENDERO_DEV_NETWORK';

export interface AndroidPermissionConfig {
  permissions?: string[];
  blockedPermissions?: string[];
}

/** True only when the developer set the flag to exactly "1". */
export function networkAllowed(env: Record<string, string | undefined>): boolean {
  return env[DEV_NETWORK_FLAG] === '1';
}

/**
 * Returns the Android permission block with INTERNET blocked (and never requested) unless the
 * debug flag is set. Other permissions are kept as they are.
 */
export function applyPrivacy(
  android: AndroidPermissionConfig,
  env: Record<string, string | undefined>,
): AndroidPermissionConfig {
  const permissions = (android.permissions ?? []).filter((p) => p !== INTERNET_PERMISSION);
  const blocked = new Set(android.blockedPermissions ?? []);
  if (networkAllowed(env)) {
    blocked.delete(INTERNET_PERMISSION);
  } else {
    blocked.add(INTERNET_PERMISSION);
  }
  return { ...android, permissions, blockedPermissions: [...blocked] };
}
