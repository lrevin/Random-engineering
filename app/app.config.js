/**
 * app.json 위에 빌드 때만 정해지는 값을 덮어씀.
 *
 * 구글 AdMob 앱 ID: ADMOB_ANDROID_APP_ID / ADMOB_IOS_APP_ID 환경변수(.env.local 또는 EAS 비밀값)에 넣으면
 * 그 값으로 빌드되고, 비어 있으면 app.json 의 뽑공 AdMob 앱 ID를 그대로 씀.
 * (앱 ID는 비밀값은 아니지만, 시험용과 실제용을 코드 수정 없이 바꾸려고 환경변수로 뺌)
 */
module.exports = ({ config }) => {
  const android = process.env.ADMOB_ANDROID_APP_ID;
  const ios = process.env.ADMOB_IOS_APP_ID;
  const valid = (id) => typeof id === "string" && /^ca-app-pub-\d{16}~\d{10}$/.test(id);
  const plugins = (config.plugins ?? []).map((p) => {
    if (!Array.isArray(p) || p[0] !== "react-native-google-mobile-ads") return p;
    return [p[0], {
      ...p[1],
      ...(valid(android) ? { androidAppId: android } : {}),
      ...(valid(ios) ? { iosAppId: ios } : {}),
    }];
  });
  return { ...config, plugins };
};
