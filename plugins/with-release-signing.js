// @ts-check
/**
 * Release signing without secrets in the repository.
 *
 * Appends a second `android {}` block to android/app/build.gradle (Groovy merges it with the first):
 * a `senderoRelease` signing configuration read from the Gradle project properties
 * SENDERO_UPLOAD_STORE_FILE, SENDERO_UPLOAD_STORE_PASSWORD, SENDERO_UPLOAD_KEY_ALIAS and
 * SENDERO_UPLOAD_KEY_PASSWORD, used by the release build type only when those properties exist.
 * scripts/build-apk passes them as ORG_GRADLE_PROJECT_* environment variables from a properties file
 * kept outside the repository. Without them the release is signed with the debug key (fine for a
 * test install, never for the altar tablet's lasting identity).
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// sendero: release signing';

const BLOCK = `
${MARKER}
android {
    signingConfigs {
        senderoRelease {
            if (project.hasProperty('SENDERO_UPLOAD_STORE_FILE')) {
                storeFile file(project.property('SENDERO_UPLOAD_STORE_FILE'))
                storePassword project.property('SENDERO_UPLOAD_STORE_PASSWORD')
                keyAlias project.property('SENDERO_UPLOAD_KEY_ALIAS')
                keyPassword project.property('SENDERO_UPLOAD_KEY_PASSWORD')
            }
        }
    }
    buildTypes {
        release {
            if (project.hasProperty('SENDERO_UPLOAD_STORE_FILE')) {
                signingConfig signingConfigs.senderoRelease
            }
        }
    }
}
`;

/**
 * Appends the signing block once (idempotent).
 * @param {string} contents
 * @returns {string}
 */
function addReleaseSigning(contents) {
  if (contents.includes(MARKER)) {
    return contents;
  }
  return `${contents.trimEnd()}\n${BLOCK}`;
}

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withReleaseSigning = (config) =>
  withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('with-release-signing: android/app/build.gradle must be Groovy');
    }
    cfg.modResults.contents = addReleaseSigning(cfg.modResults.contents);
    return cfg;
  });

module.exports = withReleaseSigning;
module.exports.addReleaseSigning = addReleaseSigning;
module.exports.MARKER = MARKER;
