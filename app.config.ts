import type { ConfigContext, ExpoConfig } from 'expo/config';

import { applyPrivacy } from './plugins/privacy';

/**
 * Dynamic config on top of app.json: applies the privacy rule (no INTERNET permission unless
 * SENDERO_DEV_NETWORK=1 for a Metro debug session).
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const base = config as ExpoConfig;
  return {
    ...base,
    android: {
      ...base.android,
      ...applyPrivacy(base.android ?? {}, process.env),
    },
  };
};
