import { showDialog } from "@/components/Dialog";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Btn, Card, Row, T } from "@/components/ui";
import { ALL_CATEGORIES } from "@/data";
import { useApp } from "@/lib/app-state";
import { UserLevelBar } from "@/components/Rank";
import { averageScore, calcStreak } from "@/lib/stats";
import { useColors } from "@/theme";
import { DomainIcon, Icon } from "@/components/Icon";
import { SectionTitle, StatGrid, StatTile } from "@/components/StatTile";
import { WeeklyReport } from "@/components/WeeklyReport";

export default function History() {
  const { records, mode, xp, keptDays, refreshRecords } = useApp();
  const c = useColors();
  const [syncing,setSyncing]=useState(false);

  const { streak, today } = calcStreak(records, new Date(), keptDays);
  const avg = averageScore(records);

  const bars = useMemo(() => {
    const counts = ALL_CATEGORIES.map((cat) => ({ ...cat, n: records.filter((r) => r.category === cat.id && r.countsAsStudy !== false).length }));
    const max = Math.max(1, ...counts.map((x) => x.n));
    return { counts: counts.filter((x) => x.n > 0).sort((a, b) => b.n - a.n), max };
  }, [records]);

  const header = (
    <View style={{ gap: 14, paddingBottom: 10 }}>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <T size={26} weight="bold">공부 기록</T>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/settings"))} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon name="close" size={24} color={c.muted} />
        </Pressable>
      </Row>

      {mode === "user" && <>
        <Btn title={syncing ? "동기화 중…" : "기록 동기화"} disabled={syncing} onPress={async()=>{
          setSyncing(true);try{await refreshRecords();}catch{showDialog({icon:"offline",title:"연결하지 못했어요",message:"기기의 기록은 유지돼요. 연결 후 다시 시도해 주세요."});}finally{setSyncing(false);}
        }}/>
        {records.some(r=>!r.synced)&&<T size={13} color="muted">서버 미반영 기록이 있어요. 전체 답안이 없는 이전 기록 등은 기기에만 보관될 수 있어요.</T>}
      </>}
      {mode === "guest" && (
        <Card style={{ backgroundColor: c.accentSoft, borderColor: c.accent, gap: 8 }}>
          <T size={14} color="ink2">둘러보기 중이에요. 기록이 이 휴대폰에만 있어서 앱을 지우면 사라져요.</T>
          <Btn title="회원가입하고 기록 지키기" variant="accent" size="sm" onPress={() => router.push("/signup")} />
        </Card>
      )}

      <SectionTitle title="학습 현황" right={<Pressable onPress={() => router.push("/profile")} hitSlop={8}><T size={14} weight="semibold" color="accent">프로필 · 업적 ›</T></Pressable>} />
      <StatGrid>
        <StatTile icon={<Icon name="flame" size={30} />} value={`${streak}일`} label={streak && !today ? "연속 · 오늘 아직!" : "연속 공부"} dim={!streak} />
        <StatTile icon={<Icon name="calendar" size={30} />} value={`${records.filter(r=>r.countsAsStudy !== false).length}회`} label="총 공부" />
        <StatTile icon={<Icon name="target" size={30} />} value={records.length ? `${avg.toFixed(1)}점` : "-"} label="평균 점수 (10점)" />
        <StatTile icon={<Icon name="bolt" size={30} />} value={`${xp.toLocaleString()}`} label="누적 XP" />
      </StatGrid>

      <WeeklyReport />

      <Pressable onPress={() => router.push("/recent")} accessibilityRole="button">
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Icon name="books" size={34} />
          <View style={{ flex: 1 }}>
            <T size={16} weight="bold">최근 공부한 주제</T>
            <T size={13} color="muted">{records.length ? `${records.length}개 · 점수와 오답 보기` : "아직 기록이 없어요"}</T>
          </View>
          <T size={18} color="muted">›</T>
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push("/review")} accessibilityRole="button">
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Icon name="target" size={34} />
          <View style={{ flex: 1 }}>
            <T size={16} weight="bold">오답 다시 풀기</T>
            <T size={13} color="muted">틀린 문제를 변형 문제로 다시 풀어요</T>
          </View>
          <Icon name="crown" size={22} />
          <T size={18} color="muted">›</T>
        </Card>
      </Pressable>

      <Card style={{ gap: 6 }}>
        <T size={14} weight="semibold" color="ink2">내 레벨</T>
        <UserLevelBar xp={xp} />
      </Card>

      {bars.counts.length > 0 && (
        <Card style={{ gap: 8 }}>
          <T size={14} weight="semibold" color="ink2">분야별 횟수</T>
          {bars.counts.map((b) => (
            <Row key={b.id} gap={10} style={{ flexWrap: "nowrap" }}>
              <Row gap={6} style={{ width: 118, flexWrap: "nowrap" }}>
                <DomainIcon id={b.domain} size={20} />
                <T size={13} numberOfLines={1} style={{ flex: 1 }}>{b.name}</T>
              </Row>
              <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: c.chip, overflow: "hidden" }}>
                <View style={{ width: `${(b.n / bars.max) * 100}%`, height: "100%", backgroundColor: b.id === "sec" ? c.accent : c.navy, borderRadius: 5 }} />
              </View>
              <T size={13} color="ink2" style={{ width: 24, textAlign: "right" }}>{b.n}</T>
            </Row>
          ))}
        </Card>
      )}

    </View>
  );

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, maxWidth: 640, width: "100%", alignSelf: "center" }}>
        {header}
      </ScrollView>
    </SafeAreaView>
  );
}
