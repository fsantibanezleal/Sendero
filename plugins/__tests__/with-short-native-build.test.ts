// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('../with-short-native-build');

describe('short native build staging plugin', () => {
  const gradle = "rootProject.name = 'Sendero'\ninclude ':app'\n";

  it('appends the staging block driven by SENDERO_CXX_ROOT', () => {
    const out: string = plugin.addShortNativeBuild(gradle);
    expect(out.startsWith('rootProject.name')).toBe(true);
    expect(out).toContain('gradle.beforeProject');
    expect(out).toContain('finalizeDsl');
    expect(out).toContain(plugin.MARKER);
    expect(out).toContain("System.getenv('SENDERO_CXX_ROOT')");
    expect(out).toContain('buildStagingDirectory');
    expect(out).toContain('-DCMAKE_OBJECT_PATH_MAX=250');
  });

  it('is idempotent across repeated prebuilds', () => {
    const once: string = plugin.addShortNativeBuild(gradle);
    const twice: string = plugin.addShortNativeBuild(once);
    expect(twice).toBe(once);
    expect(twice.split(plugin.MARKER).length - 1).toBe(1);
  });
});
