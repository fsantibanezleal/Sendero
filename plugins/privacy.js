// @ts-check
/**
 * Privacy rule of the build: the kiosk app never needs the network, so every build blocks the
 * INTERNET permission unless a developer explicitly opts in for a Metro debug session.
 *
 * Plain CommonJS because the Expo config loader transpiles only app.config.ts itself; typed by
 * privacy.d.ts and unit-tested in __tests__/privacy.test.ts.
 */

const INTERNET_PERMISSION = 'android.permission.INTERNET';

/** Environment variable that keeps the network permission for a debug session with Metro. */
const DEV_NETWORK_FLAG = 'SENDERO_DEV_NETWORK';

/**
 * True only when the developer set the flag to exactly "1".
 * @param {Record<string, string | undefined>} env
 */
function networkAllowed(env) {
  return env[DEV_NETWORK_FLAG] === '1';
}

/**
 * Returns the Android permission block with INTERNET blocked (and never requested) unless the
 * debug flag is set. Other permissions are kept as they are.
 * @param {{ permissions?: string[], blockedPermissions?: string[] }} android
 * @param {Record<string, string | undefined>} env
 */
function applyPrivacy(android, env) {
  const permissions = (android.permissions ?? []).filter((p) => p !== INTERNET_PERMISSION);
  const blocked = new Set(android.blockedPermissions ?? []);
  if (networkAllowed(env)) {
    blocked.delete(INTERNET_PERMISSION);
  } else {
    blocked.add(INTERNET_PERMISSION);
  }
  return { ...android, permissions, blockedPermissions: [...blocked] };
}

module.exports = { INTERNET_PERMISSION, DEV_NETWORK_FLAG, networkAllowed, applyPrivacy };
