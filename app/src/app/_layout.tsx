import {
  IBMPlexSansKR_400Regular, IBMPlexSansKR_500Medium, IBMPlexSansKR_600SemiBold, IBMPlexSansKR_700Bold, useFonts,
} from "@expo-google-fonts/ibm-plex-sans-kr";
import { router, Stack, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { restoreCatalog, syncCatalog } from "@/lib/catalog-sync";
import { useState, useEffect } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { Btn, T } from "@/components/ui";
import { installGlobalErrorReporter, reportClientError } from "@/lib/error-report";
import { BattleWatcher } from "@/components/BattleWatcher";
import { showDialog, DialogHost } from "@/components/Dialog";
import { initAds } from "@/lib/ads";
import { initSfx } from "@/lib/sfx";
import { StreakSheet } from "@/components/StreakSheet";
import { AppProvider, useApp } from "@/lib/app-state";
import { useColors } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = { anchor: "index" };

/** 화면 하나가 오류로 멈춰도 앱 전체가 흰 화면이 되지 않게: 안내 + 다시 시도 + 오류 보고 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const c = useColors();
  useEffect(() => { reportClientError(error, "screen"); }, [error]);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 14 }}>
        <Icon name="warning" size={56} />
        <T size={22} weight="bold" center>화면을 여는 중에 문제가 생겼어요</T>
        <T size={14} color="muted" center>공부 기록은 그대로 있어요. 다시 시도해도 같으면 홈으로 돌아가 주세요.</T>
        <View style={{ width: "100%", maxWidth: 360, gap: 10, marginTop: 8 }}>
          <Btn title="다시 시도" variant="accent" onPress={() => { retry(); }} />
          <Btn title="홈으로" onPress={() => { try { router.replace("/"); } catch { retry(); } }} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function RootNav() {
  const { ready, mode, onboarded, walletNotice } = useApp();
  const [catalogReady,setCatalogReady]=useState(false);
  const [,setCatalogRevision]=useState(0);
  useEffect(()=>{let alive=true;restoreCatalog().finally(()=>{if(alive)setCatalogReady(true);syncCatalog().then(changed=>{if(alive&&changed)setCatalogRevision(x=>x+1);}).catch(()=>{});});return()=>{alive=false;};},[]);
  const c = useColors();
  useEffect(()=>{if(walletNotice)showDialog({title:"재화 안내",message:walletNotice,buttons:[{text:"확인"}]});},[walletNotice]);
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSansKR_400Regular, IBMPlexSansKR_500Medium, IBMPlexSansKR_600SemiBold, IBMPlexSansKR_700Bold,
  });
  const loaded = ready && catalogReady && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  if (!loaded) return null;

  const started = mode !== "none";
  const inApp = started && onboarded;
  const flow = { headerShown: false, gestureEnabled: false, animation: "fade" } as const;

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={!started}>
          <Stack.Screen name="welcome" />
        </Stack.Protected>
        <Stack.Protected guard={started && !onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={inApp}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="study" options={flow} />
          <Stack.Screen name="quiz" options={flow} />
          <Stack.Screen name="result" options={flow} />
          <Stack.Screen name="record/[id]" options={{ presentation: "modal" }} />
          <Stack.Screen name="wrong/[id]" options={{ presentation: "modal" }} />
          <Stack.Screen name="interests" options={{ presentation: "modal" }} />
          <Stack.Screen name="history" />
          <Stack.Screen name="profile" options={{ presentation: "modal" }} />
          <Stack.Screen name="quests" options={{ presentation: "modal" }} />
          <Stack.Screen name="exam" options={flow} />
          <Stack.Screen name="recall" options={flow} />
          <Stack.Screen name="speed" options={flow} />
          <Stack.Screen name="report" options={{ presentation: "modal" }} />
          <Stack.Screen name="roadmap" options={{ presentation: "modal" }} />
          <Stack.Screen name="recent" options={{ presentation: "modal" }} />
          <Stack.Screen name="certs" options={{ presentation: "modal" }} />
          <Stack.Screen name="skins" options={{ presentation: "modal" }} />
          <Stack.Screen name="review" options={flow} />
          <Stack.Screen name="battle" options={flow} />
        </Stack.Protected>
        <Stack.Protected guard={mode !== "user"}>
          <Stack.Screen name="login" options={{ presentation: "modal" }} />
          <Stack.Screen name="signup" options={{ presentation: "modal" }} />
        </Stack.Protected>
        <Stack.Screen name="privacy" options={{ presentation: "modal" }} />
      </Stack>
      {inApp && <StreakSheet />}
      {inApp && <BattleWatcher />}
      <DialogHost />
    </>
  );
}

// 구글 광고 SDK 준비 (Expo Go에서는 아무것도 안 함)
initAds();
initSfx();
installGlobalErrorReporter();

export default function RootLayout() {
  return (
    <AppProvider>
      <RootNav />
    </AppProvider>
  );
}
