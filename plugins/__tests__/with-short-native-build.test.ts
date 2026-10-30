// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('../with-short-native-build');

describe('short native build staging plugin', () => {
  const gradle = 'allprojects {\n  repositories { google() }\n}\n';

  it('appends the staging block driven by SENDERO_CXX_ROOT', () => {
    const out: string = plugin.addShortNativeBuild(gradle);
    expect(out.startsWith('allprojects')).toBe(true);
    expect(out).toContain(plugin.MARKER);
    expect(out).toContain("System.getenv('SENDERO_CXX_ROOT')");
    expect(out).toContain('buildStagingDirectory');
  });

  it('is idempotent across repeated prebuilds', () => {
    const once: string = plugin.addShortNativeBuild(gradle);
    const twice: string = plugin.addShortNativeBuild(once);
    expect(twice).toBe(once);
    expect(twice.split(plugin.MARKER).length - 1).toBe(1);
  });
});
