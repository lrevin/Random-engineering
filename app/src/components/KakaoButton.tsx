import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Icon } from "@/components/Icon";
import { T, tap } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { authErrorMessage, mysqlAuth } from "@/lib/auth";
import { showDialog } from "./Dialog";
import { radius } from "@/theme";

/** 카카오 로그인 버튼 (카카오 디자인 가이드: 노란 바탕 #FEE500, 검은 말풍선, 글자 85% 검정) */
export function KakaoButton({ onError, label = "카카오 로그인", guard }: { onError?: (message: string) => void; label?: string; guard?: () => boolean }) {
  const { signInKakao } = useApp();
  const [busy, setBusy] = useState(false);
  const press = async () => {
    if (busy || (guard && !guard())) return;
    tap();
    setBusy(true);
    onError?.("");
    try {
      await signInKakao(); // 성공하면 화면 보호 규칙에 따라 자동으로 이동
      // 탈퇴 신청 후 30일 안에 다시 로그인하면 탈퇴가 철회됨
      if (mysqlAuth.takeRestored()) showDialog({ icon: "check", title: "다시 오신 걸 환영해요", message: "탈퇴 신청이 취소됐어요. 기록과 설정이 그대로 남아 있어요." });
    } catch (e) {
      onError?.(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 8 }}>
    <Pressable
      onPress={() => press()}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        minHeight: 54, borderRadius: radius.lg, backgroundColor: "#FEE500", opacity: pressed || busy ? 0.8 : 1,
      })}
    >
      {busy ? <ActivityIndicator color="#000000" /> : <Icon name="kakao" size={22} color="#000000" />}
      <T size={17} weight="semibold" style={{ color: "rgba(0,0,0,0.85)" }}>{label}</T>
    </Pressable>
    </View>
  );
}
