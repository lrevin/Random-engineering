/** Web preview uses the existing simulated-ad screen; never import the native AdMob SDK. */
export const AD_REWARD = 10;
export const AD_DAILY_LIMIT = 3;
export const adsSimulated = true;
export type AdResult = "earned" | "closed" | "failed";
export function initAds(): void {}
export async function showRewardedAd(_userId?: string | null): Promise<AdResult> {return "failed";}
