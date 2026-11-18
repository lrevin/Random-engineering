import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Platform, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BossArt, type BossMood } from "@/components/BossArt";
import { Icon } from "@/components/Icon";
import { ThemePreview } from "@/components/ThemePreview";
import { Btn, Row, T } from "@/components/ui";
import { interestName } from "@/data";
import { useApp } from "@/lib/app-state";
import {
  BOSS_HIT, BOSS_THEME, BOSS_THEME_ODDS_TEXT, MAX_MISSES, MAX_REWARD, PLAYER_HIT,
  bossMessage, localBoss, serverBoss, type BossAnswer, type BossRun, type BossStatus,
} from "@/lib/boss";
import { addTheme } from "@/lib/skins";
import { playBgm, sfx, stopBgm } from "@/lib/sfx";
import { radius } from "@/theme";
import { paletteFor } from "@/themes";

// 보스전 화면은 테마와 상관없이 지옥불 색
const BG = "linear-gradient(180deg, #2b0710 0%, #160409 45%, #0b0306 100%)";
const INK = "#fbe9e4";
const SUB = "#d9a9a2";
const PANEL = "rgba(255,255,255,0.07)";
const LINE = "rgba(255,255,255,0.14)";

/** 체력 막대 */
function Bar({ value, max, color, grad, label }: { value: number; max: number; color: string; grad: string; label: string }) {
  return (
    <View style={{ gap: 2, alignSelf: "stretch" }}>
      <T size={11} weight="bold" style={{ color: SUB }}>{label}</T>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 1, borderColor: LINE, overflow: "hidden" }}>
        <View style={{ width: `${Math.max(0, (value / max) * 100)}%`, height: "100%", backgroundColor: color, experimental_backgroundImage: grad }} />
      </View>
    </View>
  );
}

/** 오답 보스전: 관심 분야 사람들이 많이 틀린 50문제. 맞히면 보스가 맞고, 틀리면 보스가 웃음 */
export default function Boss() {
  const { mode, records, prefs, claimQuest, applyBattleXp, refreshWallet, refreshSpeedXp } = useApp();
  const member = mode === "user";
  // 보스 크기를 화면 높이에 맞춤: 보스 · 체력 · 문제 · 보기 · 다음 버튼이 스크롤 없이 한 화면에 들어오게
  const { height } = useWindowDimensions();
  const engine = useMemo(() => (member ? serverBoss() : localBoss(records, prefs.interests)), [member]); // eslint-disable-line react-hooks/exhaustive-deps
  const [info, setInfo] = useState<BossStatus | null>(null);
  const [run, setRun] = useState<BossRun | null>(null);
  const [last, setLast] = useState<BossAnswer | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [mood, setMood] = useState<BossMood>("idle");
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 애니메이션 값
  const [bob] = useState(() => new Animated.Value(0));
  const [shake] = useState(() => new Animated.Value(0));
  const [squash] = useState(() => new Animated.Value(0));
  const [flash] = useState(() => new Animated.Value(0));
  const [hop] = useState(() => new Animated.Value(0));
  const [pop] = useState(() => new Animated.Value(0));
  const [bubble, setBubble] = useState<"hit" | "laugh" | null>(null);

  useEffect(() => {
    engine.status().then(setInfo).catch((e) => setNotice(bossMessage(e)));
    // 둥둥 떠 있는 보스
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => { loop.stop(); if (moodTimer.current) clearTimeout(moodTimer.current); };
  }, [engine, bob]);

  // 싸우는 동안 배경 음악 (결과 화면 · 나가면 줄이며 멈춤)
  const runStatus = run?.status;
  useEffect(() => {
    if (runStatus === "issued") playBgm("boss");
    else if (runStatus) stopBgm(900);
  }, [runStatus]);
  useEffect(() => () => stopBgm(300), []);

  const setMoodFor = (m: BossMood, ms: number) => {
    setMood(m);
    if (moodTimer.current) clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => { setMood("idle"); setBubble(null); }, ms);
  };

  /** 한 대 맞음: 흔들림 + 찌그러짐 + 하얗게 번쩍 + 데미지 숫자 */
  const playHit = (final: boolean) => {
    sfx("boss_hit");
    setBubble("hit");
    shake.setValue(0); squash.setValue(0); flash.setValue(0); pop.setValue(0);
    Animated.parallel([
      Animated.sequence([1, -1, 0.7, -0.5, 0.2, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 45, useNativeDriver: true }))),
      Animated.sequence([
        Animated.timing(squash, { toValue: 1, duration: 70, useNativeDriver: true }),
        Animated.spring(squash, { toValue: 0, friction: 3.5, tension: 160, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(flash, { toValue: 0.75, duration: 40, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]),
      Animated.timing(pop, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (final) { setMood("down"); if (moodTimer.current) clearTimeout(moodTimer.current); } else setMoodFor("hit", 520);
  };
  /** 비웃음: 통통 튀며 웃음 + 말풍선 */
  const playLaugh = () => {
    sfx("boss_laugh");
    setBubble("laugh");
    hop.setValue(0); pop.setValue(0);
    Animated.parallel([
      Animated.sequence([0, 1, 2, 3, 4].flatMap(() => [
        Animated.timing(hop, { toValue: 1, duration: 85, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(hop, { toValue: 0, duration: 85, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ])),
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
    ]).start();
    if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setMoodFor("laugh", 1700);
  };

  const begin = async () => {
    setBusy(true); setNotice("");
    try {
      const r = await engine.start();
      setRun(r);
      if (r.status === "issued") sfx("boss_appear");
    } catch (e) { setNotice(bossMessage(e)); } finally { setBusy(false); }
  };

  /** 끝났을 때 보상 반영 (게스트는 이 휴대폰에, 회원은 서버가 이미 넣었으니 다시 읽기) */
  const settle = (r: BossRun) => {
    if (member) { void refreshWallet().catch(() => {}); void refreshSpeedXp().catch(() => {}); return; }
    if (r.status !== "cleared" || !r.reward) return;
    void claimQuest(`boss:${r.runId}`, r.reward.gears);
    applyBattleXp(`boss:${r.runId}`, r.reward.xp);
    if (r.reward.theme) addTheme(BOSS_THEME, false);
  };

  const answer = async (i: number) => {
    if (!run?.question || busy || last) return;
    setBusy(true); setPicked(i);
    try {
      const r = await engine.answer(run.question.position, i);
      setLast(r);
      if (r.correct) playHit(r.status === "cleared"); else playLaugh();
      if (r.status !== "issued") settle(r);
      // 맞히면 잠깐 보여 주고 다음 문제, 틀리면 정답 · 해설을 보고 넘어감
      if (r.correct && r.status === "issued") setTimeout(() => { setRun(r); setLast(null); setPicked(null); }, 750);
    } catch (e) { setNotice(bossMessage(e)); setPicked(null); } finally { setBusy(false); }
  };

  const shown = last ?? run;
  const bossView = (size: number) => (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{
        transform: [
          { translateY: Animated.add(bob.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }), hop.interpolate({ inputRange: [0, 1], outputRange: [0, -16] })) },
          { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-16, 16] }) },
          { rotate: hop.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-4deg"] }) },
          { scaleX: squash.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
          { scaleY: squash.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] }) },
        ],
      }}>
        <BossArt size={size} mood={mood} />
        {/* 맞을 때 번쩍 */}
        <Animated.View pointerEvents="none" style={{ position: "absolute", left: size * 0.22, right: size * 0.22, top: size * 0.15, bottom: size * 0.08, borderRadius: 18, backgroundColor: "#ffffff", opacity: flash }} />
      </Animated.View>
      {/* 데미지 숫자 · 웃음 말풍선 */}
      {bubble === "hit" ? (
        <Animated.View pointerEvents="none" style={{ position: "absolute", top: size * 0.12, right: 4,
          opacity: pop.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [10, -34] }) }, { scale: pop.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.6, 1.25, 1] }) }] }}>
          <T size={30} weight="bold" style={{ color: "#ffd34d", textShadowColor: "#7a0b1f", textShadowRadius: 6, textShadowOffset: { width: 0, height: 2 } }}>-{BOSS_HIT}</T>
        </Animated.View>
      ) : bubble === "laugh" ? (
        <Animated.View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0,
          opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }, { rotate: "-8deg" }] }}>
          <View style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: "#fff3ef", borderWidth: 2.5, borderColor: "#1b0509" }}>
            <T size={17} weight="bold" style={{ color: "#a3122a" }}>크하하하!</T>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );

  const close = (
    <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="나가기">
      <Icon name="close" size={24} color={SUB} />
    </Pressable>
  );

  // ───────── 시작 전: 보스 소개 ─────────
  if (!run) {
    const used = info?.run && info.run.status !== "issued";
    const resume = info?.run?.status === "issued";
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#160409", experimental_backgroundImage: BG }} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }}>
          <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
            <T size={24} weight="bold" style={{ color: INK }}>오답 보스전</T>
            {close}
          </Row>
          {bossView(Math.round(Math.max(120, Math.min(220, height * 0.2))))}
          {info?.interests.length ? (
            <Row gap={6} style={{ justifyContent: "center" }}>
              {info.interests.slice(0, 4).map((id) => (
                <View key={id} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: PANEL, borderWidth: 1, borderColor: LINE }}>
                  <T size={12} weight="semibold" style={{ color: INK }}>{interestName(id)}</T>
                </View>
              ))}
            </Row>
          ) : null}
          {/* 얻을 수 있는 보상 */}
          <View style={{ gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: PANEL, borderWidth: 1, borderColor: LINE }}>
            <T size={15} weight="bold" style={{ color: INK }}>처치 보상</T>
            <Row gap={10} style={{ flexWrap: "nowrap" }}>
              {[
                { icon: "gear" as const, value: `최대 ${MAX_REWARD.gears}`, label: "톱니바퀴" },
                { icon: "bolt" as const, value: `최대 ${MAX_REWARD.xp}`, label: "XP" },
              ].map((r) => (
                <View key={r.label} style={{ flex: 1, alignItems: "center", gap: 4, paddingVertical: 12, borderRadius: radius.md, backgroundColor: "rgba(0,0,0,0.3)" }}>
                  <Icon name={r.icon} size={30} />
                  <T size={18} weight="bold" style={{ color: INK }}>{r.value}</T>
                  <T size={12} style={{ color: SUB }}>{r.label}</T>
                </View>
              ))}
            </Row>
            <View style={{ gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: "#2a0f1c",
              experimental_backgroundImage: "linear-gradient(135deg, rgba(255,179,92,0.35) 0%, rgba(255,77,94,0.3) 45%, rgba(155,27,106,0.35) 100%)" }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Row gap={6}><Icon name="crown" size={20} /><T size={14} weight="bold" style={{ color: INK }}>한정 테마 · 블러드 이클립스</T></Row>
                <T size={13} weight="bold" style={{ color: "#ffd34d" }}>{BOSS_THEME_ODDS_TEXT}</T>
              </Row>
              <ThemePreview p={paletteFor(BOSS_THEME, null)} />
            </View>
          </View>
          {notice ? <T size={14} weight="semibold" center style={{ color: "#ff9a8a" }}>{notice}</T> : null}
          {!info && !notice ? <ActivityIndicator color="#ff5a4a" /> : null}
          {info && used ? (
            <T size={14} weight="semibold" center style={{ color: "#ffd34d" }}>
              이번 주 보스전은 이미 했어요{info.run?.status === "cleared" ? " (처치 성공)" : ""}. 다음 주 월요일에 새 보스가 나타나요.
            </T>
          ) : null}
        </ScrollView>
        {/* 시작 버튼은 화면 아래에 고정 (작은 폰에서도 스크롤 없이 바로 누름) */}
        {info ? (
          <View style={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 8, gap: 6 }}>
            {!used ? <Btn title={resume ? "이어서 싸우기" : "보스에게 도전하기"} variant="accent" size="lg" loading={busy} icon={<Icon name="swords" size={22} />} onPress={begin} /> : null}
            <T size={12} center style={{ color: SUB }}>{info.week.start.slice(5).replace("-", "/")} ~ {info.week.end.slice(5).replace("-", "/")} 보스</T>
          </View>
        ) : null}
      </SafeAreaView>
    );
  }

  // ───────── 결과 ─────────
  if (!last && run.status !== "issued") {
    const won = run.status === "cleared";
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#160409", experimental_backgroundImage: BG }} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }}>
          <Row style={{ justifyContent: "flex-end" }}>{close}</Row>
          <BossArt size={Math.round(Math.max(120, Math.min(200, height * 0.2)))} mood={won ? "down" : "laugh"} />
          <T size={28} weight="bold" center style={{ color: INK }}>{won ? "보스 처치!" : "보스가 버텼어요"}</T>
          <T size={14} center style={{ color: SUB }}>
            {won ? `체력 ${run.playerHp}을 남기고 이겼어요.` : `${run.position}문제까지 버텼어요. 틀린 문제를 복습하고 다음 주에 다시 도전해요.`}
          </T>
          {won && run.reward ? (
            <View style={{ gap: 10, padding: 16, borderRadius: radius.lg, backgroundColor: PANEL, borderWidth: 1, borderColor: LINE, alignItems: "center" }}>
              <T size={15} weight="bold" style={{ color: INK }}>클리어 보상</T>
              <Row gap={22}>
                <Row gap={6}><Icon name="gear" size={28} /><T size={24} weight="bold" style={{ color: INK }}>+{run.reward.gears}</T></Row>
                <Row gap={6}><Icon name="bolt" size={28} /><T size={24} weight="bold" style={{ color: INK }}>+{run.reward.xp} XP</T></Row>
              </Row>
            </View>
          ) : null}
          {run.reward?.theme ? (
            <View style={{ gap: 6, padding: 16, borderRadius: radius.lg, alignItems: "center", backgroundColor: "#2a0f1c",
              experimental_backgroundImage: "linear-gradient(135deg, #ffb35c 0%, #ff4d5e 35%, #9b1b6a 70%, #2a0f1c 100%)" }}>
              <Icon name="crown" size={44} />
              <T size={20} weight="bold" style={{ color: "#fff" }}>전설의 보상!</T>
              <T size={14} center style={{ color: "#fff3e6" }}>{BOSS_THEME_ODDS_TEXT} 확률을 뚫고 &apos;블러드 이클립스&apos; 테마를 얻었어요.</T>
              <Btn title="테마 보러 가기" size="sm" onPress={() => router.replace("/skins")} />
            </View>
          ) : null}
          <Btn title="돌아가기" variant="accent" size="lg" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ───────── 싸우는 중 ─────────
  const q = run.question;
  const misses = shown ? Math.round((100 - shown.playerHp) / PLAYER_HIT) : 0;
  const needNext = !!last && (!last.correct || last.status !== "issued");
  // 틀려서 해설이 나오면 보스를 조금 더 작게 (해설 · 다음 버튼 자리)
  const fightBoss = Math.round(Math.max(88, Math.min(150, height * (needNext ? 0.12 : 0.16))));
  const next = () => { setRun(last); setLast(null); setPicked(null); };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#160409", experimental_backgroundImage: BG }} edges={["top", "bottom"]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, gap: 8, flexGrow: 1 }}>
        <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
          {close}
          <T size={14} weight="bold" style={{ color: INK }}>{Math.min(run.position + 1, run.total)} / {run.total}</T>
          <Row gap={4}><Icon name="flame" size={18} /><T size={13} weight="bold" style={{ color: SUB }}>남은 실수 {MAX_MISSES - misses}</T></Row>
        </Row>

        {/* 보스 (위) */}
        {bossView(fightBoss)}
        {shown ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 3 }}><Bar value={shown.bossHp} max={shown.bossMaxHp} color="#ff3b2f" grad="linear-gradient(90deg, #ffb35c 0%, #ff3b2f 55%, #a3122a 100%)" label={`보스 ${shown.bossHp} / ${shown.bossMaxHp}`} /></View>
            <View style={{ flex: 2 }}><Bar value={shown.playerHp} max={100} color="#36c27a" grad="linear-gradient(90deg, #2fb36f 0%, #8be37a 100%)" label={`내 체력 ${shown.playerHp}`} /></View>
          </View>
        ) : null}

        {/* 문제 (보스 밑) */}
        <View style={{ gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.lg, backgroundColor: "rgba(255,248,240,0.96)", borderWidth: 2, borderColor: "#1b0509", borderBottomWidth: 4, marginTop: 2 }}>
          <Row gap={6}>
            {q?.topic ? <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: "#f3dcd6" }}><T size={11} weight="bold" style={{ color: "#7a0b1f" }}>{q.topic}</T></View> : null}
            {q && q.wrong > 0 ? <T size={11} weight="semibold" style={{ color: "#a3122a" }}>{member ? `같은 분야 사람들이 ${q.wrong}번 틀린 문제` : `내가 ${q.wrong}번 틀린 문제`}</T> : null}
          </Row>
          <T size={16} weight="bold" style={{ color: "#1b0509", lineHeight: 23 }}>{q?.q ?? last?.question?.q}</T>
        </View>

        <View style={{ gap: 6 }}>
          {(q?.choices ?? []).map((ch, i) => {
            const isAnswer = !!last && i === last.answer;
            const isWrongPick = !!last && !last.correct && i === picked;
            return (
              <Pressable key={i} onPress={() => answer(i)} disabled={!!last || busy} accessibilityRole="button" accessibilityLabel={`${i + 1}번 ${ch}`}
                style={({ pressed }) => ({
                  flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, paddingHorizontal: 11, borderRadius: radius.md, borderWidth: 2,
                  borderColor: isAnswer ? "#36c27a" : isWrongPick ? "#ff3b2f" : LINE,
                  backgroundColor: isAnswer ? "rgba(54,194,122,0.22)" : isWrongPick ? "rgba(255,59,47,0.22)" : PANEL,
                  borderBottomWidth: pressed && !last ? 2 : 3, transform: [{ translateY: pressed && !last ? 2 : 0 }],
                })}>
                <View style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" }}>
                  <T size={12} weight="bold" style={{ color: INK }}>{i + 1}</T>
                </View>
                <T size={14} style={{ flex: 1, color: INK, lineHeight: 20 }} numberOfLines={3}>{ch}</T>
              </Pressable>
            );
          })}
        </View>

        {notice ? <T size={13} style={{ color: "#ff9a8a" }}>{notice}</T> : null}
        {needNext && last ? (
          <View style={{ gap: 4, paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.md, backgroundColor: PANEL, borderWidth: 1, borderColor: LINE }}>
            <T size={13} weight="bold" style={{ color: last.correct ? "#8be37a" : "#ff9a8a" }}>
              {last.correct ? "마지막 일격!" : last.status === "failed" ? "체력이 다 떨어졌어요" : `보스가 비웃어요 · 내 체력 -${PLAYER_HIT}`}
            </T>
            {!last.correct && last.explain ? <T size={12} style={{ color: SUB, lineHeight: 17 }}>{last.explain}</T> : null}
          </View>
        ) : null}
      </ScrollView>
      {needNext && last ? (
        <View style={{ paddingHorizontal: 14, paddingTop: 6, paddingBottom: 10 }}>
          <Btn title={last.status === "issued" ? "다음 문제" : "결과 보기"} variant="accent" onPress={next} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
