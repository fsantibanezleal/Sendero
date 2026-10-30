// @ts-check
/**
 * Windows path-length fix for the native (CMake + ninja) build.
 *
 * Every native library builds its C++ under `<library>/android/.cxx/...`, and CMake names object
 * folders after the absolute source path, so the repository path appears twice in one object path.
 * With VisionCamera's Nitro sources that passes the 260-character limit ninja can handle on
 * Windows ("ninja: error: mkdir(...): No such file or directory").
 *
 * This plugin appends a block to android/build.gradle that moves each module's CMake staging folder
 * under a short root taken from the SENDERO_CXX_ROOT environment variable (one subfolder per Gradle
 * project: eight characters of its name plus a hash, so names never collide). Without the variable
 * the block does nothing, so other platforms are unaffected.
 */
const { withProjectBuildGradle } = require('expo/config-plugins');

const MARKER = '// sendero: short native build staging';

const BLOCK = `
${MARKER}
subprojects { sub ->
  sub.afterEvaluate {
    def cxxRoot = System.getenv('SENDERO_CXX_ROOT')
    if (cxxRoot != null && !cxxRoot.isEmpty() && sub.hasProperty('android')) {
      def cmake = sub.android.externalNativeBuild.cmake
      if (cmake.path != null) {
        def key = sub.name.replaceAll('[^A-Za-z0-9]', '').take(8) + Integer.toHexString(sub.name.hashCode() & 0xffffff)
        cmake.buildStagingDirectory = new File(cxxRoot, key)
      }
    }
  }
}
`;

/**
 * Appends the staging block once (idempotent).
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
  withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('with-short-native-build: android/build.gradle must be Groovy');
    }
    cfg.modResults.contents = addShortNativeBuild(cfg.modResults.contents);
    return cfg;
  });

module.exports = withShortNativeBuild;
module.exports.addShortNativeBuild = addShortNativeBuild;
module.exports.MARKER = MARKER;
