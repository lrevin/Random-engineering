/**
 * 휴대폰 홈 화면 아이콘 · 시작 화면을 지금 테마에 맞춤 (안드로이드, modules/theme-launcher).
 * 아이콘을 쓰던 중에 바꾸면 런처가 앱을 닫을 수 있어서, 앱이 백그라운드로 갈 때 바꿈.
 * 네이티브 모듈이 없는 빌드(웹 · 예전 APK · 아이폰)에서는 아무것도 하지 않음.
 */
import { requireOptionalNativeModule } from "expo";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";

interface ThemeLauncherNative {
  current(): string;
  apply(theme: string): boolean;
}

const native = Platform.OS === "android" ? requireOptionalNativeModule<ThemeLauncherNative>("ThemeLauncher") : null;
export const themeLauncherSupported = !!native;

let wanted: string | null = null;

function sync() {
  if (!native || !wanted) return;
  try { native.apply(wanted); } catch { /* 아이콘을 못 바꿔도 앱 동작에는 영향 없음 */ }
}

/** 루트에서 한 번: 지금 테마를 기억하고, 앱이 백그라운드로 갈 때 아이콘 · 시작 화면을 맞춤 */
export function useThemeLauncher(themeId: string) {
  useEffect(() => { wanted = themeId; }, [themeId]);
  useEffect(() => {
    if (!native) return;
    const sub = AppState.addEventListener("change", (s) => { if (s === "background") sync(); });
    return () => sub.remove();
  }, []);
}
