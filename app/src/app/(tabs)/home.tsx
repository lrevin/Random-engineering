import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Animated, Pressable, View } from "react-native";
import { TierBadge, UserLevelBar } from "@/components/Rank";
import { Slot, SlotReel } from "@/components/Slot";
import { GearCount } from "@/components/TimeUpSheet";
import { LevelButton } from "@/components/LevelSheet";
import { Badge, Btn, Card, Chip, levelTone, Row, Screen, T } from "@/components/ui";
import { categoryById, levelText, TOPICS, type Topic } from "@/data";
import { useApp } from "@/lib/app-state";
import { prefetchQuiz } from "@/lib/quiz";
import { maxRpFor, TIERS, topicMastery } from "@/lib/rank";
import { calcStreak } from "@/lib/stats";
import { radius, shadow, useColors } from "@/theme";

type LevelFilter = "0" | "1" | "2" | "3"; // 0 = 전체

export default function Home() {
  const { prefs, records, active, setActive, gears, updatePrefs, xp, keptDays, freezes } = useApp();
  const c = useColors();
  const [level, setLevel] = useState<LevelFilter>(String(prefs.level) as LevelFilter);
  // 설정에서 기본 난이도를 바꾸면 필터도 따라가게 함
  const [prefLevel, setPrefLevel] = useState(prefs.level);
  if (prefLevel !== prefs.level) {
    setPrefLevel(prefs.level);
    setLevel(String(prefs.level) as LevelFilter);
  }
  const [includeMastered, setIncludeMastered] = useState(false);
  const [shown, setShown] = useState<Topic | null>(null);
  const [drawn, setDrawn] = useState<Topic | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [pop] = useState(() => new Animated.Value(1));
  const [reel, setReel] = useState<{ key: number; names: string[]; pick: Topic } | null>(null);

  const { streak } = calcStreak(records, new Date(), keptDays);
  // 마스터 = 주제 랭크가 최고 단계(엔지니어). 같은 개념이 여러 분야에 있을 수 있어서(예: 레이놀즈 수) 이름으로도 확인
  const mastered = useMemo(() => {
    const set = new Set<string>();
    for (const id of new Set(records.map((r) => r.topicId))) {
      if (topicMastery(id, records).index !== TIERS.length - 1) continue;
      set.add(id);
      const ko = records.find((r) => r.topicId === id)?.topicKo;
      if (ko) set.add(ko);
    }
    return set;
  }, [records]);

  const inScope = useMemo(() => {
    const seen = new Set<string>();
    return TOPICS.filter((t) => {
      if (!prefs.interests.includes(t.category) || (level !== "0" && t.lv !== Number(level))) return false;
      if (seen.has(t.ko)) return false; // 여러 분야에 겹치는 개념은 한 번만
      seen.add(t.ko);
      return true;
    });
  }, [prefs.interests, level]);
  const pool = useMemo(
    () => (includeMastered ? inScope : inScope.filter((t) => !mastered.has(t.id) && !mastered.has(t.ko))),
    [inScope, includeMastered, mastered],
  );

  const draw = () => {
    if (spinning) return;
    if (!pool.length) {
      setDrawn(null);
      setShown(null);
      return;
    }
    let candidates = pool;
    if (drawn && pool.length > 1) candidates = pool.filter((t) => t.id !== drawn.id);
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    // 릴에 올릴 이름들: 맨 앞이 당첨(마지막에 멈출 주제), 뒤는 굴러가며 지나갈 주제들
    const reelPool = pool.length >= 8 ? pool : TOPICS;
    const names = [pick.ko, ...Array.from({ length: 28 }, () => reelPool[Math.floor(Math.random() * reelPool.length)].ko)];
    setReel({ key: Date.now(), names, pick });
    setSpinning(true);
    setDrawn(null);
  };

  const landed = (pick: Topic) => {
    setShown(pick);
    setDrawn(pick);
    setSpinning(false);
    setReel(null);
    pop.setValue(0.9);
    Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  };

  const start = () => {
    if (!drawn || active) return;
    prefetchQuiz(drawn); // 공부 시작을 누른 즉시 이 주제의 AI 문제 만들기 + 검수 시작
    setActive({
      topicId: drawn.id, stage: "study", memo: "",
      studyTotal: prefs.studyMinutes * 60, studyLeft: prefs.studyMinutes * 60, studyUsed: 0,
      quizOnly: false, quiz: null, result: null, startedAt: new Date().toISOString(), endAt: null,
    });
    router.push("/study");
  };

  const emptyText = !prefs.interests.length
    ? "관심 분야를 먼저 골라 주세요."
    : !pool.length
      ? includeMastered ? "조건에 맞는 주제가 없어요." : "이 조건의 주제를 모두 마스터했어요! 🎉\n'마스터한 주제 포함'을 눌러 보세요."
      : "레버를 당기거나 버튼을 눌러\n오늘의 주제를 뽑아 보세요";

  return (
    <Screen edges={["top"]} scroll contentStyle={{ flexGrow: 1 }}>
      {/* 레벨 + 연속 일수 + 톱니바퀴 */}
      <Row gap={8} style={{ justifyContent: "space-between", flexWrap: "nowrap", alignItems: "stretch" }}>
        <View style={{ flex: 1, justifyContent: "center", backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, borderBottomWidth: 3, borderBottomColor: c.paperEdge, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, ...shadow(c, 1) }}>
          <UserLevelBar xp={xp} compact />
        </View>
        <Pressable onPress={() => router.push("/shop")} accessibilityRole="button" accessibilityLabel="연속 일수, 보호권 보기" style={{ alignItems: "center", backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, borderBottomWidth: 3, borderBottomColor: c.paperEdge, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 4, ...shadow(c, 1) }}>
          <T size={22} weight="bold" color={streak ? "flame" : "muted"}>🔥 {streak}</T>
          <T size={11} color="muted">연속 일수{freezes ? ` · 🛡${freezes}` : ""}</T>
        </Pressable>
        <Pressable onPress={() => router.push("/shop")} accessibilityRole="button" accessibilityLabel="톱니바퀴 상점" style={{ alignItems: "center", backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, borderBottomWidth: 3, borderBottomColor: c.paperEdge, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 4, ...shadow(c, 1) }}>
          <View style={{ height: 32, justifyContent: "center" }}><GearCount n={gears} size={18} /></View>
          <T size={11} color="muted">톱니바퀴 ›</T>
        </Pressable>
      </Row>


      {active && (
        <Pressable onPress={() => router.push(`/${active.stage}`)}>
          <Card style={{ backgroundColor: c.accentSoft, borderColor: c.accent, paddingVertical: 12 }}>
            <T weight="semibold" color="accent">진행 중인 주제가 있어요 → 이어서 하기</T>
          </Card>
        </Pressable>
      )}

      {/* 필터 */}
      <View style={{ gap: 10 }}>
        <Row gap={10} style={{ flexWrap: "nowrap" }}>
          <LevelButton
            value={Number(level) as typeof prefs.level}
            interests={prefs.interests}
            onChange={(v) => { setLevel(String(v) as LevelFilter); updatePrefs({ level: v }).catch(() => {}); }}
          />
          <Chip
            label={`${includeMastered ? "✓ " : ""}🛠️ 마스터한 주제 포함`}
            selected={includeMastered}
            onPress={() => setIncludeMastered((v) => !v)}
            fill
          />
        </Row>
        <Pressable onPress={() => router.push("/interests")} hitSlop={6}>
          <T size={14} color="muted">
            관심 분야 {prefs.interests.length}개 · 후보 {pool.length}개{" "}
            <T size={14} color="accent" weight="semibold">바꾸기 ›</T>
          </T>
        </Pressable>
      </View>

      {/* 주제 카드 ~ 버튼: 남는 세로 공간의 가운데에 배치 */}
      <View style={{ flex: 1, justifyContent: "center", gap: 18, paddingVertical: 8 }}>
        <Slot spinning={spinning} onPull={draw} disabled={spinning || !pool.length || !!active}>
          {spinning && reel ? (
            <SlotReel key={reel.key} names={reel.names} onDone={() => landed(reel.pick)} />
          ) : shown ? (
            <Animated.View style={{ alignItems: "center", gap: 8, transform: [{ scale: pop }] }}>
              <Row gap={6} style={{ justifyContent: "center" }}>
                <Badge label={`${categoryById(shown.category)?.emoji ?? ""} ${shown.categoryName}`} />
                <Badge label={levelText(shown.lv)} tone={levelTone(shown.level)} />
              </Row>
              <T size={34} weight="bold" center color={spinning ? "ink2" : "ink"} style={{ letterSpacing: -0.8, lineHeight: 44 }}>
                {shown.ko}
              </T>
              {!spinning && (
                <>
                  <T size={14} color="muted" center>{shown.en}</T>
                  <T size={16} color="ink2" center style={{ marginTop: 4 }}>{shown.hint}</T>
                  <Row gap={8} style={{ justifyContent: "center", marginTop: 4 }}>
                    <TierBadge index={topicMastery(shown.id, records).index} size="sm" />
                    <T size={12} color="muted">퀴즈 최대 +{maxRpFor(shown)} XP</T>
                  </Row>
                </>
              )}
            </Animated.View>
          ) : (
            <T size={17} color="muted" center>{emptyText}</T>
          )}
        </Slot>


        <View style={{ gap: 10 }}>
          {drawn && !spinning && !active && <Btn title={`이걸로 시작 · ${prefs.studyMinutes}분 공부 + 퀴즈`} variant="accent" size="lg" onPress={start} />}
          <Btn
            title={spinning ? "뽑는 중…" : drawn ? "다시 뽑기" : "주제 뽑기 🎲"}
            variant={drawn ? "outline" : "primary"}
            size="lg"
            onPress={draw}
            disabled={spinning || !pool.length || !!active}
          />
          {active && <T size={13} color="muted" center>진행 중인 주제를 끝내거나 그만둔 뒤 새로 뽑을 수 있어요.</T>}
        </View>
      </View>
    </Screen>
  );
}
