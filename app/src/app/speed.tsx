import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Platform, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { SectionTitle } from "@/components/StatTile";
import { Badge, Btn, Card, Row, Screen, T } from "@/components/ui";
import { topicById, type Topic } from "@/data";
import { useApp } from "@/lib/app-state";
import { speedQuestions, type ExamItem } from "@/lib/quiz";
import { finishSpeed, readSpeed, SPEED_DAILY_XP_CAP, SPEED_SEC, SPEED_XP_PER_CORRECT, type SpeedStore } from "@/lib/speed";
import { radius, raised, shadow, useColors } from "@/theme";
import { answerText } from "./quiz";

type Phase = "ready" | "loading" | "play" | "done";
interface Answered { item: ExamItem; ok: boolean }

/** 스피드 퀴즈: 1분 동안 공부한 주제의 4지선다 문제를 최대한 많이 맞히기 */
export default function Speed() {
  const { records, applyBattleXp } = useApp();
  const c = useColors();
  const [store, setStore] = useState<SpeedStore | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [pool, setPool] = useState<ExamItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [log, setLog] = useState<Answered[]>([]);
  const [combo, setCombo] = useState(0);
  const [left, setLeft] = useState(SPEED_SEC);
  const [flash, setFlash] = useState<boolean | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<{ xp: number; newBest: boolean } | null>(null);
  const [shake] = useState(() => new Animated.Value(0));
  const endAt = useRef(0);

  useEffect(() => { readSpeed().then(setStore); }, []);

  // 한 번 이상 공부한 주제 (배틀 기록 포함)
  const studied = useMemo(() => {
    const out: Topic[] = [];
    for (const id of new Set(records.map((r) => r.topicId))) {
      const t = topicById(id);
      if (t) out.push(t);
    }
    return out;
  }, [records]);

  // 1분 타이머
  useEffect(() => {
    if (phase !== "play") return;
    const t = setInterval(() => {
      const s = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setLeft(s);
      if (s <= 0) setPhase("done");
    }, 200);
    return () => clearInterval(t);
  }, [phase]);

  // 끝나면 경험치 지급 (한 번만)
  const correct = log.filter((x) => x.ok).length;
  useEffect(() => {
    if (phase !== "done" || result) return;
    finishSpeed(correct).then(({ store: s, xp, newBest }) => {
      if (xp > 0) applyBattleXp(`speed:${Date.now()}`, xp);
      setStore(s);
      setResult({ xp, newBest });
    });
  }, [phase, result, correct, applyBattleXp]);

  const start = async () => {
    if (!studied.length) return;
    setPhase("loading");
    const qs = await speedQuestions(studied);
    if (!qs.length) { setPhase("ready"); return; }
    setPool(qs);
    setIdx(0);
    setLog([]);
    setCombo(0);
    setResult(null);
    setFlash(null);
    setPicked(null);
    endAt.current = Date.now() + SPEED_SEC * 1000;
    setLeft(SPEED_SEC);
    setPhase("play");
  };

  const answer = (v: number) => {
    if (phase !== "play" || flash !== null) return;
    const item = pool[idx % pool.length];
    const ok = item.q.answer === v;
    setPicked(v);
    if (Platform.OS !== "web") Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
    if (!ok) {
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 50, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 50, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
    setFlash(ok);
    setLog((l) => [...l, { item, ok }]);
    setCombo((k) => (ok ? k + 1 : 0));
    setTimeout(() => { setFlash(null); setPicked(null); setIdx((i) => i + 1); }, ok ? 250 : 700);
  };

  // ───────── 준비 · 불러오는 중 ─────────
  if (phase === "loading") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", gap: 14 }}>
        <ActivityIndicator size="large" color={c.accent} />
        <T size={17} weight="semibold">공부한 주제에서 문제를 고르고 있어요</T>
      </SafeAreaView>
    );
  }

  // ───────── 게임 중 ─────────
  if (phase === "play") {
    const item = pool[idx % pool.length];
    const pct = left / SPEED_SEC;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: flash === null ? c.bg : flash ? c.successSoft : c.accentSoft }} edges={["top", "bottom"]}>
        <View style={{ padding: 20, gap: 14, flex: 1 }}>
          <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
            <Row gap={6}><Icon name="clock" size={24} /><T size={26} weight="bold" color={left <= 10 ? "accent" : "ink"}>{left}초</T></Row>
            <Row gap={10}>
              {combo >= 3 && <Badge label={`${combo} 콤보!`} tone="accent" />}
              <T size={22} weight="bold" color="success">{correct}개</T>
            </Row>
          </Row>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: c.chip, overflow: "hidden" }}>
            <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: left <= 10 ? c.accent : c.gold }} />
          </View>

          <Animated.View style={{ flex: 1, justifyContent: "center", gap: 12, transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] }) }] }}>
            <View style={{ alignSelf: "center" }}><Badge label={`${item.topic.categoryName} · ${item.topic.ko}`} /></View>
            <T size={21} weight="bold" center style={{ lineHeight: 30 }}>{item.q.q}</T>
          </Animated.View>

          <View style={{ gap: 10 }}>
            {item.q.type === "mc" && item.q.choices.map((ch, i) => {
              const isAnswer = flash !== null && i === item.q.answer;
              const isWrongPick = flash === false && i === picked;
              return (
                <Pressable
                  key={i}
                  onPress={() => answer(i)}
                  accessibilityRole="button"
                  accessibilityLabel={`${i + 1}번 ${ch}`}
                  style={({ pressed }) => ({
                    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 14, borderRadius: radius.lg, borderWidth: 2,
                    borderColor: isAnswer ? c.success : isWrongPick ? c.accent : c.line2,
                    backgroundColor: isAnswer ? c.successSoft : isWrongPick ? c.accentSoft : c.paper,
                    ...raised(isAnswer ? c.successDeep : isWrongPick ? c.accentDeep : c.paperEdge, pressed && flash === null, 5),
                    ...(!pressed ? shadow(c, 1) : null),
                  })}
                >
                  <View style={{ width: 28, height: 28, borderRadius: 8, borderWidth: 1.5, borderBottomWidth: 3, borderColor: c.line2, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }}>
                    <T size={13} weight="bold" color="ink2">{i + 1}</T>
                  </View>
                  <T size={15} style={{ flex: 1 }} numberOfLines={3}>{ch}</T>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ───────── 결과 ─────────
  if (phase === "done") {
    const missed = log.filter((x) => !x.ok);
    return (
      <Screen scroll>
        <View style={{ alignItems: "center", gap: 6, paddingTop: 8 }}>
          <Icon name={result?.newBest ? "trophy" : "bolt"} size={72} />
          <T size={16} color="ink2">1분 동안</T>
          <T size={56} weight="bold" color="success" style={{ lineHeight: 64 }}>{correct}<T size={24} weight="bold" color="muted">개 정답</T></T>
          <T size={14} color="muted">{log.length}문제 풂 · 정답률 {log.length ? Math.round((correct / log.length) * 100) : 0}%</T>
          {result?.newBest && <Badge label="최고 기록!" tone="accent" />}
          {result && (
            <Row gap={4}>
              <Icon name="star" size={20} />
              <T size={16} weight="bold" color={result.xp ? "accent" : "muted"}>
                {result.xp ? `+${result.xp} XP` : "오늘 받을 수 있는 경험치를 다 받았어요"}
              </T>
            </Row>
          )}
          <T size={12} color="muted" center>사용자 경험치만 올라가요. 분야 랭크에는 들어가지 않아요.</T>
        </View>

        {missed.length > 0 && (
          <>
            <SectionTitle title={`틀린 문제 ${missed.length}개`} />
            {missed.slice(0, 10).map(({ item }, i) => (
              <Card key={i} style={{ gap: 6 }}>
                <T size={12} color="muted">{item.topic.categoryName} · {item.topic.ko}</T>
                <T size={15} weight="semibold">{item.q.q}</T>
                <T size={14} color="success" weight="semibold">정답: {answerText(item.q)}</T>
                <T size={14} color="ink2">{item.q.explain}</T>
              </Card>
            ))}
          </>
        )}

        <Btn title="한 판 더" variant="accent" size="lg" onPress={start} />
        <Btn title="닫기" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  // ───────── 시작 화면 ─────────
  const xpLeft = store ? Math.max(0, SPEED_DAILY_XP_CAP - store.xpToday) : SPEED_DAILY_XP_CAP;
  return (
    <Screen scroll>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <T size={26} weight="bold">스피드 퀴즈</T>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon name="close" size={24} color={c.muted} />
        </Pressable>
      </Row>
      <T color="ink2">1분 동안 내가 공부한 주제의 4지선다 문제를 최대한 많이 맞혀 보세요.</T>

      <Card style={{ alignItems: "center", gap: 6, paddingVertical: 22 }}>
        <Icon name="bolt" size={56} />
        <T size={14} color="muted">내 최고 기록</T>
        <T size={40} weight="bold">{store?.best ?? 0}<T size={18} weight="bold" color="ink2">개</T></T>
      </Card>

      <Card style={{ gap: 8 }}>
        <Row gap={8}><Icon name="star" size={20} /><T size={14}>정답 1개당 <T size={14} weight="bold">{SPEED_XP_PER_CORRECT} XP</T> · 오늘 남은 경험치 {xpLeft} XP</T></Row>
        <Row gap={8}><Icon name="book" size={20} /><T size={14}>출제 범위: 공부한 주제 {studied.length}개</T></Row>
        <T size={12} color="muted">분야 랭크와 공부 기록에는 들어가지 않아요.</T>
      </Card>

      <Btn
        title={studied.length ? "시작" : "먼저 주제를 하나 공부해 주세요"}
        variant="accent" size="lg" icon={studied.length ? <Icon name="play" size={22} color="#ffffff" /> : undefined}
        onPress={start} disabled={!studied.length}
      />
    </Screen>
  );
}
