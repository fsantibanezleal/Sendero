// @ts-check
/**
 * Config plugin of the kiosk: makes MainActivity a HOME activity (a separate intent filter, the
 * LAUNCHER filter stays) and allows it to run in lock task mode when the app is allowlisted by the
 * device owner. The device admin receiver lives in the module's own manifest (modules/sendero-kiosk).
 *
 * It also opts the app out of Android's camera compatibility treatment on large screens (forced
 * rotation to the camera sensor's orientation, letterboxing, activity refresh): Sendero draws the camera
 * itself, upright, in any orientation, and the treatment rotated and letterboxed the altar screen.
 *
 * Plain CommonJS like privacy.js; typed by with-kiosk.d.ts and tested in __tests__/with-kiosk.test.ts.
 */
const { withAndroidManifest } = require('expo/config-plugins');

const ACTION_MAIN = 'android.intent.action.MAIN';
const CATEGORY_HOME = 'android.intent.category.HOME';
const CATEGORY_DEFAULT = 'android.intent.category.DEFAULT';

/** Application properties that turn off camera compatibility force rotation and refresh. */
const CAMERA_COMPAT_OPT_OUT = [
  'android.window.PROPERTY_CAMERA_COMPAT_ALLOW_FORCE_ROTATION',
  'android.window.PROPERTY_CAMERA_COMPAT_ALLOW_REFRESH',
];

/**
 * Adds the HOME filter and the lockTaskMode attribute to MainActivity; idempotent.
 * @template T
 * @param {T} manifest the decoded AndroidManifest (config.modResults)
 * @returns {T}
 */
function addKioskToManifest(manifest) {
  const apps = /** @type {any} */ (manifest).manifest.application ?? [];
  /** @type {any[]} */
  const activities = apps.flatMap((/** @type {any} */ app) => app.activity ?? []);
  const main = activities.find((a) => {
    const name = a.$?.['android:name'];
    return typeof name === 'string' && name.endsWith('.MainActivity');
  });
  if (!main) throw new Error('with-kiosk: MainActivity not found in AndroidManifest.xml');

  main.$['android:lockTaskMode'] = 'if_whitelisted';

  const filters = main['intent-filter'] ?? (main['intent-filter'] = []);
  const hasHome = filters.some((/** @type {any} */ f) =>
    (f.category ?? []).some((/** @type {any} */ c) => c.$?.['android:name'] === CATEGORY_HOME),
  );
  if (!hasHome) {
    filters.push({
      action: [{ $: { 'android:name': ACTION_MAIN } }],
      category: [{ $: { 'android:name': CATEGORY_HOME } }, { $: { 'android:name': CATEGORY_DEFAULT } }],
    });
  }

  for (const app of apps) {
    const props = app.property ?? (app.property = []);
    for (const name of CAMERA_COMPAT_OPT_OUT) {
      if (!props.some((/** @type {any} */ p) => p.$?.['android:name'] === name)) {
        props.push({ $: { 'android:name': name, 'android:value': 'false' } });
      }
    }
  }
  return manifest;
}

/** @param {any} config */
function withKiosk(config) {
  return withAndroidManifest(config, (cfg) => {
    cfg.modResults = addKioskToManifest(cfg.modResults);
    return cfg;
  });
}

module.exports = withKiosk;
module.exports.addKioskToManifest = addKioskToManifest;
