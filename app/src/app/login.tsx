import { AuthApiError } from "@/lib/auth-client";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { KakaoButton } from "@/components/KakaoButton";
import { Btn, Field, Screen, T } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { authErrorMessage } from "@/lib/auth";

export default function Login() {
  const { signIn, cancelDeletion } = useApp();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pendingDeletion, setPendingDeletion] = useState(false);

  const submit = async (cancel = false) => {
    if (!email.trim() || !pw) return setErr("이메일과 비밀번호를 입력해 주세요.");
    setBusy(true);
    setErr("");
    try {
      if(cancel) await cancelDeletion(email,pw);
      else await signIn(email, pw); // 성공하면 화면 보호 규칙에 따라 자동으로 이동
    } catch (e) {
      setErr(authErrorMessage(e));
      setPendingDeletion(e instanceof AuthApiError && e.code === "account_deleting");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen scroll>
        <T size={28} weight="bold" style={{ marginTop: 12 }}>로그인</T>
        <Field label="이메일" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" placeholder="you@example.com" />
        <Field label="비밀번호" value={pw} onChangeText={setPw} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={() => submit()} />
        {err ? <T color="accent">{err}</T> : null}
        <Btn title="로그인" variant="primary" size="lg" onPress={() => submit()} loading={busy} />
        {pendingDeletion && <Btn title="탈퇴 신청 취소 후 로그인" variant="ghost" onPress={() => submit(true)} loading={busy} />}
        <T size={13} color="muted" center>또는</T>
        <KakaoButton onError={setErr} />
        <View style={{ alignItems: "center", gap: 4 }}>
          <Btn title="처음이에요 → 회원가입" variant="ghost" onPress={() => router.replace("/signup")} />
          <Btn title="닫기" variant="ghost" size="sm" onPress={() => router.back()} />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
