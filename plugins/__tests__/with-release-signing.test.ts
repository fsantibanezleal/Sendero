// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('../with-release-signing');

describe('release signing plugin', () => {
  const gradle = "android {\n    signingConfigs {\n        debug {\n            storeFile file('debug.keystore')\n        }\n    }\n}\n";

  it('adds a release signing config read from project properties, never a secret', () => {
    const out: string = plugin.addReleaseSigning(gradle);
    expect(out.startsWith('android {')).toBe(true);
    expect(out).toContain("project.hasProperty('SENDERO_UPLOAD_STORE_FILE')");
    expect(out).toContain('signingConfig signingConfigs.senderoRelease');
    const added = out.slice(gradle.length);
    expect(added).not.toMatch(/storePassword\s+'/);
    expect(added).not.toMatch(/\.jks|\.p12|\.keystore/);
  });

  it('is idempotent across repeated prebuilds', () => {
    const once: string = plugin.addReleaseSigning(gradle);
    expect(plugin.addReleaseSigning(once)).toBe(once);
  });
});
