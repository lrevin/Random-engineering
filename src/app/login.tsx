import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { Btn, Field, Screen, T } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { authErrorMessage } from "@/lib/supabase";

export default function Login() {
  const { signIn } = useApp();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!email.trim() || !pw) return setErr("이메일과 비밀번호를 입력해 주세요.");
    setBusy(true);
    setErr("");
    try {
      await signIn(email, pw); // 성공하면 화면 보호 규칙에 따라 자동으로 이동
    } catch (e) {
      setErr(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen scroll>
        <T size={28} weight="bold" style={{ marginTop: 12 }}>로그인</T>
        <Field label="이메일" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" placeholder="you@example.com" />
        <Field label="비밀번호" value={pw} onChangeText={setPw} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={submit} />
        {err ? <T color="accent">{err}</T> : null}
        <Btn title="로그인" variant="primary" size="lg" onPress={submit} loading={busy} />
        <View style={{ alignItems: "center", gap: 4 }}>
          <Btn title="처음이에요 → 회원가입" variant="ghost" onPress={() => router.replace("/signup")} />
          <Btn title="닫기" variant="ghost" size="sm" onPress={() => router.back()} />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
