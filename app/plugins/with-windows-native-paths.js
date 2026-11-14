const { withAppBuildGradle } = require("expo/config-plugins");

const marker = "// Short native build paths for Windows Ninja.";
function patchBuildGradle(contents) {
  if (contents.includes(marker)) return contents;
  if (!/^android \{/m.test(contents)) throw new Error("Android Gradle block not found");
  return contents.replace(/^android \{/m, `android {
    ${marker}
    externalNativeBuild {
        cmake {
            if (System.getProperty("os.name").toLowerCase().contains("windows")) {
                buildStagingDirectory rootProject.file("../../.cxx/app")
            }
        }
    }
`);
}

module.exports = function withWindowsNativePaths(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") throw new Error("Expected Groovy app build.gradle");
    config.modResults.contents = patchBuildGradle(config.modResults.contents);
    return config;
  });
};
module.exports.patchBuildGradle = patchBuildGradle;
