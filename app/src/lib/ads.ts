import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

/**
 * 보상형 광고 (구글 AdMob, react-native-google-mobile-ads).
 * - 광고를 끝까지 보면 톱니바퀴 AD_REWARD개. 인플레이션을 막으려고 하루 AD_DAILY_LIMIT번까지.
 * - Expo Go에는 광고 SDK가 없어서 불러오지 않음 → 앱이 5초짜리 시험용 광고 화면을 대신 보여 줌.
 * - 개발 빌드(__DEV__)에서는 항상 구글 공개 시험용 광고 (자기 광고 클릭으로 계정 정지되는 것 방지).
 * - 출시용 빌드에서는 뽑공 AdMob 계정의 보상형 광고 단위 (환경변수로 바꿀 수 있음).
 */
/** 뽑공 AdMob 보상형 광고 단위 '톱니바퀴 보상' (비밀값 아님: 앱 안에 그대로 들어가는 값) */
const REWARDED_UNIT = {
  android: "ca-app-pub-2812024386507663/1651172098",
  ios: "ca-app-pub-2812024386507663/3760274779",
};
export const AD_REWARD = 10;
export const AD_DAILY_LIMIT = 3;

export const adsSimulated = Constants.executionEnvironment === ExecutionEnvironment.StoreClient || Platform.OS === "web";

type AdsModule = typeof import("react-native-google-mobile-ads");
let mod: AdsModule | null | undefined;
function ads(): AdsModule | null {
  if (mod !== undefined) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = adsSimulated ? null : (require("react-native-google-mobile-ads") as AdsModule);
  } catch {
    mod = null;
  }
  return mod;
}

let started = false;
/** 앱 시작 때 한 번 (광고 SDK 준비). 실패해도 앱은 그대로 */
export function initAds() {
  const m = ads();
  if (!m || started) return;
  started = true;
  m.default().initialize().catch(() => {});
}

const unitId = () => {
  const m = ads();
  const own = Platform.OS === "ios"
    ? process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS || REWARDED_UNIT.ios
    : process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID || REWARDED_UNIT.android;
  return !__DEV__ && own ? own : m!.TestIds.REWARDED;
};

export type AdResult = "earned" | "closed" | "failed";

/** 보상형 광고를 불러와 보여 줌. 끝까지 봤으면 "earned" */
/** userId: 회원이면 우리 회원 id → 구글이 서버로 보내는 확인(SSV)에 실려 서버가 지급함 */
export function showRewardedAd(userId?: string | null): Promise<AdResult> {
  const m = ads();
  if (!m) return Promise.resolve("failed");
  return new Promise((resolve) => {
    const ad = m.RewardedAd.createForAdRequest(unitId(), {
      requestNonPersonalizedAdsOnly: true,
      ...(userId ? { serverSideVerificationOptions: { userId } } : {}),
    });
    let earned = false;
    let done = false;
    const unsubs: (() => void)[] = [];
    const finish = (r: AdResult) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      unsubs.forEach((u) => u());
      resolve(r);
    };
    // 광고를 20초 안에 못 불러오면 포기
    const timer = setTimeout(() => finish("failed"), 20000);
    unsubs.push(ad.addAdEventListener(m.RewardedAdEventType.LOADED, () => {
      clearTimeout(timer);
      ad.show().catch(() => finish("failed"));
    }));
    unsubs.push(ad.addAdEventListener(m.RewardedAdEventType.EARNED_REWARD, () => { earned = true; }));
    unsubs.push(ad.addAdEventListener(m.AdEventType.CLOSED, () => finish(earned ? "earned" : "closed")));
    unsubs.push(ad.addAdEventListener(m.AdEventType.ERROR, () => finish("failed")));
    ad.load();
  });
}
