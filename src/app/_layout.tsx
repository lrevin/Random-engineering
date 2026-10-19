import {
  IBMPlexSansKR_400Regular, IBMPlexSansKR_500Medium, IBMPlexSansKR_600SemiBold, IBMPlexSansKR_700Bold, useFonts,
} from "@expo-google-fonts/ibm-plex-sans-kr";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppProvider, useApp } from "@/lib/app-state";
import { useColors } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = { anchor: "index" };

function RootNav() {
  const { ready, mode, onboarded } = useApp();
  const c = useColors();
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSansKR_400Regular, IBMPlexSansKR_500Medium, IBMPlexSansKR_600SemiBold, IBMPlexSansKR_700Bold,
  });
  const loaded = ready && (fontsLoaded || !!fontError);

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
          <Stack.Screen name="explain" options={flow} />
          <Stack.Screen name="finish" options={flow} />
          <Stack.Screen name="record/[id]" options={{ presentation: "modal" }} />
          <Stack.Screen name="interests" options={{ presentation: "modal" }} />
        </Stack.Protected>
        <Stack.Protected guard={mode !== "user"}>
          <Stack.Screen name="login" options={{ presentation: "modal" }} />
          <Stack.Screen name="signup" options={{ presentation: "modal" }} />
        </Stack.Protected>
        <Stack.Screen name="privacy" options={{ presentation: "modal" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <RootNav />
    </AppProvider>
  );
}
