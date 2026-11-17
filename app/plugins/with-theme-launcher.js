/**
 * 테마별 홈 화면 아이콘 · 시작 화면 (안드로이드). modules/theme-launcher 네이티브 모듈과 짝.
 *
 * - AndroidManifest: MainActivity의 실행(LAUNCHER) 항목을 빼고, 테마마다 실행 별칭(.Launcher_<id>)을 만듦.
 *   classic만 처음부터 켜져 있고, 앱이 테마를 바꾸면 모듈이 별칭 하나만 켬 → 홈 화면 아이콘이 바뀜
 * - 아이콘 그림: assets/theme-icons/<id>/ (python scripts/make_theme_icons.py 로 만듦)을 res 에 복사
 * - 시작 화면: 테마마다 ThemeLauncherSplash_<id> 스타일 (안드로이드 13+에서 모듈이 다음 실행 시작 화면으로 지정)
 */
const fs = require("fs");
const path = require("path");
const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");

const ICON_DIR = path.join(__dirname, "..", "assets", "theme-icons");

function themeIds() {
  if (!fs.existsSync(ICON_DIR)) return [];
  return fs.readdirSync(ICON_DIR).filter((id) => /^[a-z]+$/.test(id) && fs.existsSync(path.join(ICON_DIR, id, "foreground.png"))).sort();
}

const isLauncher = (filter) =>
  (filter.action ?? []).some((a) => a.$["android:name"] === "android.intent.action.MAIN") &&
  (filter.category ?? []).some((c) => c.$["android:name"] === "android.intent.category.LAUNCHER");

function withManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application[0];
    const main = (app.activity ?? []).find((a) => a.$["android:name"] === ".MainActivity");
    if (!main) throw new Error("with-theme-launcher: .MainActivity 를 찾지 못했어요");
    main["intent-filter"] = (main["intent-filter"] ?? []).filter((f) => !isLauncher(f));
    const ids = ["classic", ...themeIds()];
    app["activity-alias"] = [
      ...(app["activity-alias"] ?? []).filter((a) => !String(a.$["android:name"]).startsWith(".Launcher_")),
      ...ids.map((id) => ({
        $: {
          "android:name": `.Launcher_${id}`,
          "android:enabled": id === "classic" ? "true" : "false",
          "android:exported": "true",
          "android:label": "@string/app_name",
          "android:icon": id === "classic" ? "@mipmap/ic_launcher" : `@mipmap/ic_theme_${id}`,
          "android:roundIcon": id === "classic" ? "@mipmap/ic_launcher_round" : `@mipmap/ic_theme_${id}`,
          "android:targetActivity": ".MainActivity",
        },
        "intent-filter": [{
          action: [{ $: { "android:name": "android.intent.action.MAIN" } }],
          category: [{ $: { "android:name": "android.intent.category.LAUNCHER" } }],
        }],
      })),
    ];
    return cfg;
  });
}

function withResources(config) {
  return withDangerousMod(config, ["android", async (cfg) => {
    const res = path.join(cfg.modRequest.platformProjectRoot, "app", "src", "main", "res");
    const ids = themeIds();
    const put = (dir, name, from) => {
      fs.mkdirSync(path.join(res, dir), { recursive: true });
      fs.copyFileSync(from, path.join(res, dir, name));
    };
    put("drawable-nodpi", "theme_mono.png", path.join(__dirname, "..", "assets", "android-icon-monochrome.png"));
    const colors = [], styles = [], stylesV31 = [];
    for (const id of ids) {
      const src = (f) => path.join(ICON_DIR, id, f);
      put("drawable-nodpi", `theme_${id}_fg.png`, src("foreground.png"));
      put("drawable-nodpi", `theme_${id}_bg.png`, src("background.png"));
      put("drawable-nodpi", `theme_${id}_splash.png`, src("splash.png"));
      put("mipmap-xxxhdpi", `ic_theme_${id}.png`, src("legacy.png"));
      fs.mkdirSync(path.join(res, "mipmap-anydpi-v26"), { recursive: true });
      fs.writeFileSync(path.join(res, "mipmap-anydpi-v26", `ic_theme_${id}.xml`),
        `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@drawable/theme_${id}_bg"/>
  <foreground android:drawable="@drawable/theme_${id}_fg"/>
  <monochrome android:drawable="@drawable/theme_mono"/>
</adaptive-icon>
`);
      const meta = JSON.parse(fs.readFileSync(src("meta.json"), "utf8"));
      colors.push(`  <color name="theme_splash_${id}">${meta.splashBg}</color>`);
      const items = `    <item name="windowSplashScreenBackground">@color/theme_splash_${id}</item>
    <item name="windowSplashScreenAnimatedIcon">@drawable/theme_${id}_splash</item>`;
      styles.push(`  <style name="ThemeLauncherSplash_${id}" parent="Theme.App.SplashScreen">
${items}
  </style>`);
      stylesV31.push(`  <style name="ThemeLauncherSplash_${id}" parent="Theme.App.SplashScreen">
${items}
    <item name="android:windowSplashScreenBackground">@color/theme_splash_${id}</item>
    <item name="android:windowSplashScreenAnimatedIcon">@drawable/theme_${id}_splash</item>
  </style>`);
    }
    const arr = `  <string-array name="theme_launcher_ids" translatable="false">
${["classic", ...ids].map((id) => `    <item>${id}</item>`).join("\n")}
  </string-array>`;
    fs.writeFileSync(path.join(res, "values", "theme_launcher.xml"),
      `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${arr}\n${colors.join("\n")}\n${styles.join("\n")}\n</resources>\n`);
    fs.mkdirSync(path.join(res, "values-v31"), { recursive: true });
    fs.writeFileSync(path.join(res, "values-v31", "theme_launcher.xml"),
      `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${stylesV31.join("\n")}\n</resources>\n`);
    return cfg;
  }]);
}

module.exports = (config) => withResources(withManifest(config));
