// @ts-check
/**
 * Windows path-length fix for the native (CMake + ninja) build.
 *
 * Every native library builds its C++ under `<library>/android/.cxx/...`, and CMake names object
 * folders after the absolute source path, so the repository path appears twice in one object path.
 * With VisionCamera's Nitro sources that passes the 260-character limit ninja can handle on
 * Windows ("ninja: error: mkdir(...): No such file or directory").
 *
 * This plugin appends a hook to android/settings.gradle: before each project is evaluated it
 * registers an Android Gradle Plugin `finalizeDsl` callback that (1) moves the module's CMake
 * staging folder under a short root taken from the SENDERO_CXX_ROOT environment variable (one
 * subfolder per project: eight characters of its name plus a hash, so names never collide), and
 * (2) passes -DCMAKE_OBJECT_PATH_MAX=250 (CMake's own Windows default), so CMake shortens long
 * object names by hashing the source directory part (the
 * Android toolchain otherwise assumes a large Linux limit; some React Native codegen object paths
 * exceed 260 characters even relative to their build folder). The hook lives in settings.gradle
 * because some modules are evaluated before the root build.gradle, and finalizeDsl is the last
 * point where the DSL can still change. Without the variable it does nothing.
 */
const { withSettingsGradle } = require('expo/config-plugins');

const MARKER = '// sendero: short native build staging';

const BLOCK = `
${MARKER}
gradle.beforeProject { p ->
  def cxxRoot = System.getenv('SENDERO_CXX_ROOT')
  if (cxxRoot == null || cxxRoot.isEmpty()) {
    return
  }
  ['com.android.library', 'com.android.application'].each { id ->
    p.plugins.withId(id) {
      p.androidComponents.finalizeDsl { ext ->
        def key = p.name.replaceAll('[^A-Za-z0-9]', '').take(8) + Integer.toHexString(p.name.hashCode() & 0xffffff)
        ext.externalNativeBuild.cmake.buildStagingDirectory = new File(cxxRoot, key)
        def args = ext.defaultConfig.externalNativeBuild.cmake.arguments
        // React Native passes 1024 (no shortening); replace it.
        args.removeAll { it.startsWith('-DCMAKE_OBJECT_PATH_MAX=') }
        args.add('-DCMAKE_OBJECT_PATH_MAX=250')
      }
    }
  }
}
`;

/**
 * Appends the hook once (idempotent).
 * @param {string} contents
 * @returns {string}
 */
function addShortNativeBuild(contents) {
  if (contents.includes(MARKER)) {
    return contents;
  }
  return `${contents.trimEnd()}\n${BLOCK}`;
}

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withShortNativeBuild = (config) =>
  withSettingsGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('with-short-native-build: android/settings.gradle must be Groovy');
    }
    cfg.modResults.contents = addShortNativeBuild(cfg.modResults.contents);
    return cfg;
  });

module.exports = withShortNativeBuild;
module.exports.addShortNativeBuild = addShortNativeBuild;
module.exports.MARKER = MARKER;
