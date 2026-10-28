import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, View } from "react-native";
import { TierBadge, UserRankBar } from "@/components/Rank";
import { Slot } from "@/components/Slot";
import { GearCount } from "@/components/TimeUpSheet";
import { TopicLinks } from "@/components/TopicLinks";
import { Badge, Btn, Card, Chip, levelTone, Row, Screen, Segment, T } from "@/components/ui";
import { categoryById, levelText, TOPICS, type Topic } from "@/data";
import { useApp } from "@/lib/app-state";
import { maxRpFor, TIERS, topicMastery, totalRp } from "@/lib/rank";
import { calcStreak, lastWeek } from "@/lib/stats";
import { radius, shadow, useColors } from "@/theme";

type LevelFilter = "0" | "1" | "2" | "3"; // 0 = 전체

export default function Home() {
  const { prefs, records, active, setActive, gears } = useApp();
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
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const { streak, today } = calcStreak(records);
  const week = lastWeek(records);
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
    const reel = pool.length >= 8 ? pool : TOPICS;
    setSpinning(true);
    setDrawn(null);
    const dur = 1200 + Math.random() * 600;
    const t0 = Date.now();
    const step = () => {
      const el = Date.now() - t0;
      if (el >= dur) {
        setShown(pick);
        setDrawn(pick);
        setSpinning(false);
        pop.setValue(0.9);
        Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }).start();
        return;
      }
      setShown(reel[Math.floor(Math.random() * reel.length)]);
      const p = el / dur;
      timer.current = setTimeout(step, 45 + p * p * 230);
    };
    step();
  };

  const start = () => {
    if (!drawn || active) return;
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
    <Screen edges={["top"]} scroll>
      {/* 인사 + 스트릭 */}
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <View style={{ flex: 1 }}>
          <T size={14} color="muted">{today ? "오늘 공부 완료 ✓" : "오늘은 아직이에요"}</T>
          <T size={22} weight="bold" numberOfLines={1}>{prefs.nickname || "학습자"}님, 안녕하세요</T>
        </View>
        <View style={{ alignItems: "center", backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, borderBottomWidth: 3, borderBottomColor: c.paperEdge, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 4, ...shadow(c, 1) }}>
          <T size={22} weight="bold" color={streak ? "flame" : "muted"}>🔥 {streak}</T>
          <T size={11} color="muted">연속 일수</T>
        </View>
        <View style={{ alignItems: "center", backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, borderBottomWidth: 3, borderBottomColor: c.paperEdge, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 4, ...shadow(c, 1) }}>
          <View style={{ height: 32, justifyContent: "center" }}><GearCount n={gears} size={18} /></View>
          <T size={11} color="muted">톱니바퀴</T>
        </View>
      </Row>

      <Card style={{ paddingVertical: 12 }}>
        <UserRankBar rp={totalRp(records)} compact />
      </Card>

      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        {week.map((d, i) => (
          <View key={i} style={{ alignItems: "center", gap: 4, flex: 1 }}>
            <View style={{
              width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center",
              backgroundColor: d.done ? c.flame : c.paper, borderWidth: d.done ? 0 : 1.5, ...(d.done ? shadow(c, 1) : null),
              borderColor: d.isToday ? c.accent : c.line2, borderStyle: d.isToday && !d.done ? "dashed" : "solid",
            }}>
              {d.done && <T size={13} weight="bold" color="accentInk">✓</T>}
            </View>
            <T size={12} color={d.isToday ? "accent" : "muted"} weight={d.isToday ? "semibold" : "regular"}>{d.label}</T>
          </View>
        ))}
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
        <Row style={{ justifyContent: "space-between" }}>
          <Segment<LevelFilter>
            value={level}
            onChange={setLevel}
            options={[{ value: "0", label: "전체" }, { value: "1", label: "Lv.1" }, { value: "2", label: "Lv.2" }, { value: "3", label: "Lv.3" }]}
          />
          <Chip
            label={`${includeMastered ? "✓ " : ""}🛠️ 마스터한 주제 포함`}
            selected={includeMastered}
            onPress={() => setIncludeMastered((v) => !v)}
          />
        </Row>
        <Pressable onPress={() => router.push("/interests")} hitSlop={6}>
          <T size={14} color="muted">
            관심 분야 {prefs.interests.length}개 · 후보 {pool.length}개{" "}
            <T size={14} color="accent" weight="semibold">바꾸기 ›</T>
          </T>
        </Pressable>
      </View>

      {/* 주제 카드 */}
      <Slot spinning={spinning} onPull={draw} disabled={spinning || !pool.length || !!active}>
        {shown ? (
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
                  <T size={12} color="muted">퀴즈 최대 +{maxRpFor(shown)} RP</T>
                </Row>
              </>
            )}
          </Animated.View>
        ) : (
          <T size={17} color="muted" center>{emptyText}</T>
        )}
      </Slot>

      {drawn && !spinning && <TopicLinks topic={drawn} />}

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
    </Screen>
  );
}
