import { router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { useColors } from "@/theme";

/**
 * 결제 페이지가 끝나고 돌아오는 주소 ppobgong://billing?result=... 를 받는 빈 화면.
 * 결과는 결제를 연 화면(상점 구독 카드)이 받아서 보여 주므로, 여기서는 원래 화면으로 바로 돌아감.
 * (이 화면이 없으면 안드로이드에서 'Unmatched Route'가 뜸)
 */
export default function BillingReturn() {
  const c = useColors();
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/shop");
  }, []);
  return <View style={{ flex: 1, backgroundColor: c.bg }} />;
}
