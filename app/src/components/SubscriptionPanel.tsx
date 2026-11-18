import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { showDialog } from "./Dialog";
import { Btn, T } from "./ui";
import { useApp } from "@/lib/app-state";
import {
  cancelSubscription, getSubscription, monthDay, resumeSubscription, startSubscription, subscriptionMessage,
  SUB_BONUS_GEARS, SUB_PRICE, type Subscription,
} from "@/lib/subscription";
import { radius, useColors } from "@/theme";

/** 상점 '뽑공 프리미엄' 카드 아래: 회원의 월 구독 (구독하기 · 다음 결제일 · 해지 · 해지 취소) */
export function SubscriptionPanel() {
  const { refreshWallet } = useApp();
  const c = useColors();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(() => { getSubscription().then(setSub).catch(() => setSub(null)); }, []);
  useFocusEffect(load);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setNotice(null);
    try { await fn(); } catch (e) { setNotice({ text: subscriptionMessage((e as { code?: string }).code), ok: false }); }
    finally { setBusy(false); load(); void refreshWallet().catch(() => {}); }
  };
  const subscribe = () => run(async () => {
    const r = await startSubscription();
    if (r.result === "success") setNotice({ text: `프리미엄이 시작됐어요! 톱니바퀴 ${SUB_BONUS_GEARS}개를 받았어요.`, ok: true });
    else if (r.result === "fail") setNotice({ text: subscriptionMessage(r.code), ok: false });
  });
  const askCancel = () => showDialog({
    icon: "warning",
    title: "구독을 해지할까요?",
    message: `${monthDay(sub?.currentPeriodEnd ?? null)}까지는 프리미엄을 그대로 쓸 수 있고, 그 뒤로는 결제되지 않아요.`,
    buttons: [
      { text: "계속 쓰기", style: "cancel" },
      { text: "해지하기", style: "destructive", onPress: () => run(async () => { await cancelSubscription(); setNotice({ text: "해지했어요. 남은 기간은 계속 쓸 수 있어요.", ok: true }); }) },
    ],
  });

  if (!sub) return null;
  const box = { gap: 8, borderWidth: 1.5, borderColor: c.gold, borderRadius: radius.md, padding: 14, backgroundColor: c.goldSoft };
  return (
    <View style={{ gap: 10 }}>
      {sub.status === "active" && (
        <View style={box}>
          <T size={15} weight="bold">월 {SUB_PRICE.toLocaleString()}원 구독 중</T>
          <T size={13} color="ink2">다음 결제일 {monthDay(sub.nextChargeAt)}{sub.card ? ` · ${sub.card}` : ""}</T>
          <Btn title="구독 해지" size="sm" variant="ghost" onPress={askCancel} loading={busy} />
        </View>
      )}
      {sub.status === "canceled" && (
        <View style={box}>
          <T size={15} weight="bold">해지됨 · {monthDay(sub.currentPeriodEnd)}까지 이용</T>
          <T size={13} color="ink2">그 뒤로는 결제되지 않아요.</T>
          <Btn title="해지 취소하고 계속 구독" size="sm" variant="accent" onPress={() => run(async () => { await resumeSubscription(); setNotice({ text: "다시 구독하고 있어요.", ok: true }); })} loading={busy} />
        </View>
      )}
      {sub.status === "past_due" && (
        <View style={box}>
          <T size={15} weight="bold" color="accent">결제에 실패했어요</T>
          <T size={13} color="ink2">카드 한도 · 잔액을 확인해 주세요. 하루 뒤 다시 결제를 시도하고, 3번 실패하면 구독이 끝나요.</T>
          <Btn title="구독 해지" size="sm" variant="ghost" onPress={askCancel} loading={busy} />
        </View>
      )}
      {(sub.status === "none" || sub.status === "ended") && (
        <>
          <Btn title={sub.available ? `월 ${SUB_PRICE.toLocaleString()}원으로 구독하기` : "결제 준비 중"} variant="accent" size="lg" disabled={!sub.available} loading={busy} onPress={subscribe} />
          <T size={12} color="muted" center>카드를 등록하면 바로 첫 달이 결제되고 한 달마다 자동으로 결제돼요.{"\n"}언제든 해지할 수 있고, 해지해도 남은 기간은 쓸 수 있어요.</T>
        </>
      )}
      {notice ? <T size={13} color={notice.ok ? "success" : "accent"} weight="semibold" center>{notice.text}</T> : null}
    </View>
  );
}
