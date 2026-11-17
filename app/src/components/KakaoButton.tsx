import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { AuthApiError } from "@/lib/auth-client";
import { Icon } from "@/components/Icon";
import { Btn, T, tap } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { authErrorMessage } from "@/lib/auth";
import { radius } from "@/theme";

/** 카카오 로그인 버튼 (카카오 디자인 가이드: 노란 바탕 #FEE500, 검은 말풍선, 글자 85% 검정) */
export function KakaoButton({ onError, label = "카카오 로그인", guard }: { onError?: (message: string) => void; label?: string; guard?: () => boolean }) {
  const { signInKakao } = useApp();
  const [busy, setBusy] = useState(false);
  // 탈퇴 신청 중인 카카오 계정이면 '탈퇴 취소 후 로그인' 버튼을 보여 줌
  const [deleting, setDeleting] = useState(false);
  const press = async (restore = false) => {
    if (busy || (guard && !guard())) return;
    tap();
    setBusy(true);
    onError?.("");
    try {
      await signInKakao(restore); // 성공하면 화면 보호 규칙에 따라 자동으로 이동
      setDeleting(false);
    } catch (e) {
      onError?.(authErrorMessage(e));
      setDeleting(e instanceof AuthApiError && e.code === "account_deleting");
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
    {deleting && <Btn title="탈퇴 신청 취소 후 카카오로 로그인" variant="ghost" onPress={() => press(true)} loading={busy} />}
    </View>
  );
}
