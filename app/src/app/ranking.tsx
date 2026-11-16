import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { showDialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { LevelBadge, TierBadge } from "@/components/Rank";
import { Badge, Btn, Card, Row, Screen, Segment, T } from "@/components/ui";
import { domainById } from "@/data";
import { useApp } from "@/lib/app-state";
import { getRanking, leaderboardMessage, reportNickname, type Ranking, type RankingEntry, type RankingKind } from "@/lib/leaderboard";
import { radius, shadow, useColors } from "@/theme";

const TABS: { value: RankingKind; label: string; desc: string; empty: string }[] = [
  { value: "weekly", label: "주간 XP", desc: "이번 주 월요일부터 모은 경험치 순위예요", empty: "이번 주에 경험치를 얻은 사람이 아직 없어요. 첫 번째가 돼 보세요!" },
  { value: "level", label: "레벨", desc: "지금까지 쌓은 경험치로 정한 레벨 순위예요", empty: "아직 경험치를 쌓은 사람이 없어요." },
  { value: "tier", label: "분야 랭크", desc: "가장 높은 분야 랭크 순위예요", empty: "아직 분야 랭크를 받은 사람이 없어요." },
];

/** 순위 옆에 보여 줄 값: 주간 XP · 레벨 · 분야 랭크 */
function Value({ kind, e }: { kind: RankingKind; e: RankingEntry }) {
  if (kind === "level") return <LevelBadge level={e.level ?? 1} size="sm" />;
  if (kind === "tier") {
    return (
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <TierBadge index={e.tier ?? 0} size="sm" />
        <T size={11} color="muted" numberOfLines={1}>{domainById(e.domain ?? "")?.name ?? ""}</T>
      </View>
    );
  }
  return <T size={15} weight="bold" color="ink2">{e.value.toLocaleString()} XP</T>;
}

/** 1~3등 시상대: 가운데 1등을 가장 높게 */
function Podium({ kind, top, onLong }: { kind: RankingKind; top: RankingEntry[]; onLong: (e: RankingEntry) => void }) {
  const c = useColors();
  const coin = ["#f7b500", "#b9c2d3", "#c98a5a"];
  const edge = ["#c98f00", "#8e9aaf", "#a9714b"];
  const order = [top[1], top[0], top[2]];
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
      {order.map((e, i) => {
        if (!e) return <View key={i} style={{ flex: 1 }} />;
        const place = e.rank;
        const k = Math.min(2, place - 1);
        const first = i === 1;
        return (
          <Pressable key={`${e.rank}-${e.nickname}-${i}`} onLongPress={() => onLong(e)} delayLongPress={500} style={{ flex: 1, alignItems: "center", gap: 6 }}>
            {first && <Icon name="crown" size={30} />}
            <View style={{
              width: first ? 72 : 60, height: first ? 72 : 60, borderRadius: 40, alignItems: "center", justifyContent: "center",
              backgroundColor: coin[k], borderWidth: 3, borderColor: e.me ? c.accent : c.paper, boxShadow: `0px 4px 0px ${edge[k]}`,
            }}>
              <T size={first ? 28 : 24} weight="bold" style={{ color: "#1d2742", lineHeight: first ? 36 : 30 }}>{e.nickname.slice(0, 1)}</T>
            </View>
            <T size={14} weight="bold" numberOfLines={1}>{e.nickname}</T>
            <Value kind={kind} e={e} />
            <View style={{
              alignSelf: "stretch", height: first ? 56 : place === 2 ? 40 : 28, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md,
              backgroundColor: c.chip, borderWidth: 1, borderColor: c.line, alignItems: "center", justifyContent: "center",
            }}>
              <T size={first ? 22 : 18} weight="bold" color="ink2">{place}</T>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 랭킹: 주간 XP · 레벨 · 분야 랭크 (분야 상관없이 전체 유저) */
export default function RankingScreen() {
  const { mode } = useApp();
  const c = useColors();
  const [kind, setKind] = useState<RankingKind>("weekly");
  const [boards, setBoards] = useState<Partial<Record<RankingKind, Ranking>>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const tab = TABS.find((t) => t.value === kind)!;
  const board = boards[kind];

  useEffect(() => {
    if (mode !== "user") return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await getRanking(kind);
        if (alive) setBoards((b) => ({ ...b, [kind]: r }));
      } catch (e) {
        if (alive) setError(leaderboardMessage(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [kind, mode]);

  const askReport = (e: RankingEntry) => {
    if (e.me || !e.uid) return;
    const uid = e.uid;
    showDialog({
      icon: "warning",
      title: "닉네임 신고",
      message: `'${e.nickname}' 닉네임이 욕설·불쾌한 표현이면 신고해 주세요. 여러 명이 신고하면 랭킹에서 가려져요.`,
      buttons: [
        { text: "취소", style: "cancel" },
        { text: "신고하기", style: "destructive", onPress: () => {
          reportNickname(uid)
            .then(() => showDialog({ title: "신고했어요", message: "알려 주셔서 고마워요." }))
            .catch((err) => showDialog({ icon: "warning", title: "신고하지 못했어요", message: leaderboardMessage(err) }));
        } },
      ],
    });
  };

  const rest = board ? board.entries.filter((e) => e.rank > 3) : [];
  const top = board ? board.entries.filter((e) => e.rank <= 3).slice(0, 3) : [];

  return (
    <Screen scroll>
      <Row gap={12} style={{ flexWrap: "nowrap" }}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="뒤로">
          <Icon name="close" size={24} color={c.muted} />
        </Pressable>
        <T size={24} weight="bold">랭킹</T>
      </Row>

      <Segment<RankingKind> fill value={kind} onChange={setKind} options={TABS.map((t) => ({ value: t.value, label: t.label }))} />
      <T size={13} color="muted" center>{tab.desc}</T>

      {mode !== "user" ? (
        <Card style={{ gap: 12, alignItems: "center", paddingVertical: 24 }}>
          <Icon name="trophy" size={56} />
          <T size={16} weight="bold" center>로그인하면 전체 랭킹을 볼 수 있어요</T>
          <T size={13} color="ink2" center>다른 학습자와 경험치 · 레벨 · 분야 랭크를 겨뤄 보세요.</T>
          <Btn title="회원가입 · 로그인" variant="accent" onPress={() => router.push("/signup")} style={{ alignSelf: "stretch" }} />
        </Card>
      ) : loading && !board ? (
        <Card style={{ alignItems: "center", paddingVertical: 28 }}><ActivityIndicator /></Card>
      ) : error && !board ? (
        <Card><T size={14} color="muted">{error}</T></Card>
      ) : board && board.entries.length === 0 ? (
        <Card><T size={14} color="muted">{tab.empty}</T></Card>
      ) : board ? (
        <>
          {/* 내 순위 */}
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radius.lg,
            backgroundColor: c.accentSoft, borderWidth: 2, borderColor: c.accent, ...shadow(c, 1),
          }}>
            <T size={14} weight="semibold" style={{ flex: 1 }}>내 순위</T>
            {board.me ? (
              <>
                <T size={18} weight="bold" color="accent">{board.me.rank}위</T>
                <Value kind={kind} e={board.me} />
              </>
            ) : (
              <T size={13} color="muted">{kind === "weekly" ? "이번 주 기록이 아직 없어요" : "아직 기록이 없어요"}</T>
            )}
          </View>

          <Card style={{ paddingTop: 20 }}>
            <Podium kind={kind} top={top} onLong={askReport} />
          </Card>

          {rest.length > 0 && (
            <Card style={{ paddingVertical: 4 }}>
              {rest.map((e, i) => (
                <Pressable key={`${e.rank}-${i}`} onLongPress={() => askReport(e)} delayLongPress={500} accessibilityHint={e.me ? undefined : "길게 누르면 닉네임을 신고해요"}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.line,
                    backgroundColor: e.me ? c.accentSoft : "transparent", marginHorizontal: e.me ? -8 : 0, paddingHorizontal: e.me ? 8 : 0, borderRadius: e.me ? radius.sm : 0 }}>
                  <T size={15} weight="bold" color="muted" style={{ width: 28, textAlign: "center" }}>{e.rank}</T>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.chip, alignItems: "center", justifyContent: "center" }}>
                    <T size={16} weight="bold" color="ink2">{e.nickname.slice(0, 1)}</T>
                  </View>
                  <Row gap={6} style={{ flex: 1, flexWrap: "nowrap" }}>
                    <T size={15} weight={e.me ? "bold" : "semibold"} numberOfLines={1} style={{ flexShrink: 1 }}>{e.nickname}</T>
                    {e.me && <Badge label="나" tone="accent" />}
                  </Row>
                  <Value kind={kind} e={e} />
                </Pressable>
              ))}
            </Card>
          )}
          <T size={12} color="muted" center>부적절한 닉네임은 길게 눌러 신고할 수 있어요.</T>
        </>
      ) : null}

      {mode === "user" && <Pressable onPress={() => router.push("/leaderboard")} hitSlop={8} accessibilityRole="button" style={{ alignSelf: "center", paddingVertical: 6 }}>
        <T size={14} weight="semibold" color="accent">분야별 XP 랭킹 보기 ›</T>
      </Pressable>}
    </Screen>
  );
}
