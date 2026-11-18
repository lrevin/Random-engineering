import { router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { useColors } from "@/theme";

/**
 * 카카오 로그인이 끝나고 돌아오는 주소 ppobgong://auth/kakao?code=... 를 받는 빈 화면.
 * 코드는 로그인을 연 화면(lib/kakao-login.ts)이 받아서 처리하므로, 여기서는 원래 화면으로 바로 돌아감.
 */
export default function KakaoReturn() {
  const c = useColors();
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, []);
  return <View style={{ flex: 1, backgroundColor: c.bg }} />;
}
