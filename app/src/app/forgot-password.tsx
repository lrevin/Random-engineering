import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { Btn, Field, Screen, T } from "@/components/ui";
import { authErrorMessage, mysqlAuth } from "@/lib/auth";

/**
 * 비밀번호 찾기 (이메일로 가입한 계정): 1) 이메일 → 6자리 확인 코드 메일  2) 코드 + 새 비밀번호
 * 가입 여부는 알려 주지 않음 (어떤 이메일이든 같은 안내). 카카오로 가입한 계정은 비밀번호가 없어서 카카오 로그인을 쓰면 됨.
 */
export default function ForgotPassword() {
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr("");
    try { await fn(); } catch (e) { setErr(authErrorMessage(e)); } finally { setBusy(false); }
  };
  const send = () => {
    if (!email.trim()) return setErr("가입한 이메일을 입력해 주세요.");
    run(async () => { await mysqlAuth.forgotPassword(email.trim()); setStep("code"); });
  };
  const reset = () => {
    if (!/^\d{6}$/.test(code.trim())) return setErr("메일로 받은 6자리 숫자를 입력해 주세요.");
    if ([...pw].length < 8) return setErr("새 비밀번호는 8자 이상으로 정해 주세요.");
    if (pw !== pw2) return setErr("새 비밀번호가 서로 달라요.");
    run(async () => { await mysqlAuth.resetPassword(email.trim(), code.trim(), pw); setStep("done"); });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen scroll>
        <T size={28} weight="bold" style={{ marginTop: 12 }}>비밀번호 찾기</T>
        {step === "email" && (
          <>
            <T color="ink2">가입한 이메일로 6자리 확인 코드를 보내 드려요.</T>
            <Field label="이메일" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" placeholder="you@example.com" onSubmitEditing={send} />
            {err ? <T color="accent">{err}</T> : null}
            <Btn title="확인 코드 받기" variant="primary" size="lg" onPress={send} loading={busy} />
            <T size={13} color="muted" center>카카오로 가입했다면 비밀번호 없이 카카오 로그인을 쓰면 돼요.</T>
          </>
        )}
        {step === "code" && (
          <>
            <T color="ink2">{email.trim()}로 가입되어 있다면 확인 코드를 보냈어요. 15분 안에 입력해 주세요. 메일이 안 보이면 스팸함도 확인해 주세요.</T>
            <Field label="확인 코드 6자리" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" placeholder="123456" />
            <Field label="새 비밀번호 (8자 이상)" value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
            <Field label="새 비밀번호 확인" value={pw2} onChangeText={setPw2} secureTextEntry autoComplete="new-password" textContentType="newPassword" onSubmitEditing={reset} />
            {err ? <T color="accent">{err}</T> : null}
            <Btn title="비밀번호 바꾸기" variant="primary" size="lg" onPress={reset} loading={busy} />
            <Btn title="코드 다시 받기" variant="ghost" onPress={() => { setCode(""); send(); }} disabled={busy} />
          </>
        )}
        {step === "done" && (
          <>
            <T color="ink2">비밀번호를 바꿨어요. 다른 기기의 로그인은 모두 풀렸어요. 새 비밀번호로 로그인해 주세요.</T>
            <Btn title="로그인하러 가기" variant="primary" size="lg" onPress={() => router.replace("/login")} />
          </>
        )}
        <Btn title="닫기" variant="ghost" size="sm" onPress={() => router.back()} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
