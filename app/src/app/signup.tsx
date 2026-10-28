import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import { Btn, Card, Field, Row, Screen, T, tap } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { authErrorMessage } from "@/lib/supabase";
import { radius, shadow, useColors } from "@/theme";

function Check({ checked, onToggle, label, onOpen }: { checked: boolean; onToggle: () => void; label: string; onOpen?: () => void }) {
  const c = useColors();
  return (
    <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => { tap(); onToggle(); }} style={{ flexDirection: "row", gap: 10, alignItems: "center", flex: 1 }}>
        <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: checked ? c.accent : c.line2, backgroundColor: checked ? c.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
          {checked && <T size={13} weight="bold" color="accentInk">✓</T>}
        </View>
        <T size={15} style={{ flexShrink: 1 }}>{label}</T>
      </Pressable>
      {onOpen && (
        <Pressable onPress={onOpen} hitSlop={8}>
          <T size={13} color="muted" style={{ textDecorationLine: "underline" }}>보기</T>
        </Pressable>
      )}
    </Row>
  );
}

export default function Signup() {
  const { signUp, mode } = useApp();
  const c = useColors();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [agreeAge, setAgeOk] = useState(false);
  const [agreeTerms, setTermsOk] = useState(false);
  const [agreePrivacy, setPrivacyOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);

  const allAgreed = agreeAge && agreeTerms && agreePrivacy;

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr("이메일 형식을 확인해 주세요.");
    if (pw.length < 8) return setErr("비밀번호는 8자 이상으로 정해 주세요.");
    if (pw !== pw2) return setErr("비밀번호 확인이 일치하지 않아요.");
    if (!allAgreed) return setErr("필수 항목에 모두 동의해 주세요.");
    setBusy(true);
    setErr("");
    try {
      const { needsConfirm } = await signUp(email, pw);
      if (needsConfirm) setSent(true);
    } catch (e) {
      setErr(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <Screen contentStyle={{ justifyContent: "center" }}>
        <Card accent style={{ gap: 10 }}>
          <T size={22} weight="bold">메일함을 확인해 주세요 ✉️</T>
          <T color="ink2">{email} 로 인증 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인하면 가입이 끝나요.</T>
        </Card>
        <Btn title="로그인하러 가기" variant="primary" size="lg" onPress={() => router.replace("/login")} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen scroll>
        <T size={28} weight="bold" style={{ marginTop: 12 }}>회원가입</T>
        {mode === "guest" && <T color="ink2">가입하면 지금까지의 둘러보기 기록과 관심 분야가 계정으로 옮겨져요.</T>}
        <Field label="이메일" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" placeholder="you@example.com" />
        <Field label="비밀번호 (8자 이상)" value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
        <Field label="비밀번호 확인" value={pw2} onChangeText={setPw2} secureTextEntry autoComplete="new-password" textContentType="newPassword" />

        <View style={{ borderWidth: 1, borderColor: c.line, borderBottomWidth: 3, borderBottomColor: c.paperEdge, borderRadius: radius.md, padding: 14, gap: 12, backgroundColor: c.paper, ...shadow(c, 1) }}>
          <Check
            checked={allAgreed}
            onToggle={() => { const v = !allAgreed; setAgeOk(v); setTermsOk(v); setPrivacyOk(v); }}
            label="전체 동의"
          />
          <View style={{ height: 1, backgroundColor: c.line }} />
          <Check checked={agreeAge} onToggle={() => setAgeOk(!agreeAge)} label="(필수) 만 14세 이상입니다" />
          <Check checked={agreeTerms} onToggle={() => setTermsOk(!agreeTerms)} label="(필수) 이용약관 동의" onOpen={() => router.push("/privacy?doc=terms")} />
          <Check checked={agreePrivacy} onToggle={() => setPrivacyOk(!agreePrivacy)} label="(필수) 개인정보 수집·이용 동의" onOpen={() => router.push("/privacy")} />
        </View>

        {err ? <T color="accent">{err}</T> : null}
        <Btn title="가입하기" variant="accent" size="lg" onPress={submit} loading={busy} />
        <View style={{ alignItems: "center" }}>
          <Btn title="이미 계정이 있어요 → 로그인" variant="ghost" onPress={() => router.replace("/login")} />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
