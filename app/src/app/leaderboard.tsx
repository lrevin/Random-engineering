import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { showDialog } from "@/components/Dialog";
import { DomainIcon, Icon } from "@/components/Icon";
import { Badge, Card, Row, T } from "@/components/ui";
import { DOMAINS } from "@/data";
import { useApp } from "@/lib/app-state";
import { getLeaderboard, getLeaderboardHidden, leaderboardMessage, reportNickname, setLeaderboardHidden, type Leaderboard, type LeaderboardEntry } from "@/lib/leaderboard";
import { radius, screenBg, useColors } from "@/theme";

export default function LeaderboardScreen() {
  const { mode, prefs } = useApp();
  const c = useColors();
  const available = useMemo(() => DOMAINS.filter((d) => d.available !== false), []);
  const [domain, setDomain] = useState(() => prefs.interests[0] ?? available[0]?.id ?? "");
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState<boolean | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    if (mode !== "user") return;
    let alive = true;
    getLeaderboardHidden().then((h) => { if (alive) setHidden(h); }).catch(() => {});
    return () => { alive = false; };
  }, [mode]);

  const toggleShown = async (shown: boolean) => {
    const prev = hidden;
    setHidden(!shown);
    try {
      setHidden(await setLeaderboardHidden(!shown));
      setRev((x) => x + 1);
    } catch (e) {
      setHidden(prev);
      showDialog({ icon: "warning", title: "바꾸지 못했어요", message: leaderboardMessage(e) });
    }
  };

  const askReport = (e: LeaderboardEntry) => {
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

  useEffect(() => {
    if (mode !== "user" || !domain) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await getLeaderboard(domain);
        if (alive) setBoard(r);
      } catch (e) {
        if (alive) setError(leaderboardMessage(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [domain, mode, rev]);

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, ...screenBg(c) }}>
      <ScrollView contentContainerStyle={{ padding: 20, maxWidth: 640, width: "100%", alignSelf: "center", gap: 14 }}>
        <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
          <T size={26} weight="bold">분야별 랭킹</T>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/profile"))} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
            <Icon name="close" size={24} color={c.muted} />
          </Pressable>
        </Row>

        {mode !== "user" ? (
          <Card><T size={14} color="muted">회원가입하고 로그인하면 전체 유저 랭킹을 볼 수 있어요.</T></Card>
        ) : (
          <>
            {hidden !== null && (
              <Card style={{ paddingVertical: 10 }}>
                <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                  <T size={14} style={{ flex: 1 }}>다른 사람 랭킹에 내 닉네임 보이기</T>
                  <Switch value={!hidden} onValueChange={toggleShown} trackColor={{ true: c.accent, false: c.line2 }} thumbColor={c.paper} />
                </Row>
                {hidden && <T size={12} color="muted">숨김 상태예요. 내 순위는 나에게만 보여요.</T>}
              </Card>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {available.map((d) => (
                <Pressable key={d.id} onPress={() => setDomain(d.id)} accessibilityRole="button"
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 2, borderColor: domain === d.id ? c.accent : c.line, backgroundColor: domain === d.id ? c.accentSoft : c.paper }}>
                  <DomainIcon id={d.id} size={16} />
                  <T size={13} weight="semibold" color={domain === d.id ? "accent" : "ink2"}>{d.name}</T>
                </Pressable>
              ))}
            </ScrollView>

            {loading ? (
              <Card style={{ alignItems: "center", paddingVertical: 24 }}><ActivityIndicator /></Card>
            ) : error ? (
              <Card><T size={14} color="muted">{error}</T></Card>
            ) : board && board.entries.length === 0 ? (
              <Card><T size={14} color="muted">아직 이 분야에서 기록을 쌓은 사람이 없어요.</T></Card>
            ) : board ? (
              <>
                {board.me && board.me.rank > board.entries.length && (
                  <Card style={{ backgroundColor: c.accentSoft, borderColor: c.accent }}>
                    <Row style={{ justifyContent: "space-between" }}>
                      <T size={14} weight="semibold">내 순위</T>
                      <T size={14} weight="bold" color="accent">{board.me.rank}위 · {board.me.xp.toLocaleString()} XP</T>
                    </Row>
                  </Card>
                )}
                <Card style={{ gap: 8 }}>
                  {board.entries.map((e, i) => (
                    <Pressable key={`${e.rank}-${i}`} onLongPress={() => askReport(e)} delayLongPress={500} accessibilityHint={e.me ? undefined : "길게 누르면 닉네임을 신고해요"}>
                    <Row gap={10} style={{ flexWrap: "nowrap", justifyContent: "space-between", backgroundColor: e.me ? c.accentSoft : "transparent", borderRadius: radius.sm, paddingHorizontal: e.me ? 8 : 0, paddingVertical: e.me ? 4 : 0 }}>
                      <Row gap={10} style={{ flexWrap: "nowrap" }}>
                        {e.rank <= 3 ? <Icon name={e.rank === 1 ? "crown" : "medal"} size={22} /> : <T size={14} color="muted" style={{ width: 22, textAlign: "center" }}>{e.rank}</T>}
                        <T size={14} weight={e.me ? "bold" : "regular"} numberOfLines={1}>{e.nickname}</T>
                        {e.me && <Badge label="나" tone="accent" />}
                      </Row>
                      <T size={14} weight="semibold" color="ink2">{e.xp.toLocaleString()} XP</T>
                    </Row>
                    </Pressable>
                  ))}
                </Card>
                <T size={12} color="muted" center>부적절한 닉네임은 길게 눌러 신고할 수 있어요.</T>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
