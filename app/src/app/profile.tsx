import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Share, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AchievementBadge, AchievementRow } from "@/components/Achievements";
import { DomainIcon, Icon, TierIcon } from "@/components/Icon";
import { LevelBadge, TierBadge } from "@/components/Rank";
import { ProgressBar } from "@/components/Quests";
import { domainById } from "@/data";
import { SectionTitle, StatGrid, StatTile } from "@/components/StatTile";
import { Btn, Card, T, tap } from "@/components/ui";
import { ACHIEVEMENT_GROUPS, achievements, type AchievementExtra } from "@/lib/achievements";
import { useApp } from "@/lib/app-state";
import { readExamStore } from "@/lib/exam";
import { readDone } from "@/lib/review";
import { titleById, useCosmetics } from "@/lib/skins";
import { TitleBadge } from "./skins";
import { domainRanks, userLevel } from "@/lib/rank";
import { getFriends, socialEnabled } from "@/lib/social";
import { calcStreak, isBattleRecord } from "@/lib/stats";
import { radius, raised, shadow, useColors } from "@/theme";

/** 슬롯 릴 무늬 (프로필 위 남색 배경) */
function ReelPattern() {
  const cols = [0, 1, 2, 3, 4, 5, 6];
  return (
    <View style={{ position: "absolute", inset: 0, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 6, opacity: 0.1 }} pointerEvents="none">
      {cols.map((i) => (
        <View key={i} style={{ gap: 10, marginTop: i % 2 ? -26 : -6 }}>
          {[0, 1, 2, 3, 4].map((k) => <View key={k} style={{ width: 40, height: 46, borderRadius: 10, backgroundColor: "#fffaf0" }} />)}
        </View>
      ))}
    </View>
  );
}

export default function Profile() {
  const { prefs, uid, xp, records, keptDays, freezes, gears, questClaims } = useApp();
  const c = useColors();
  const [friends, setFriends] = useState<number | null>(null);

  useFocusEffect(useCallback(() => {
    if (!socialEnabled) return;
    getFriends().then((s) => setFriends(s.friends.length)).catch(() => {});
  }, []));

  const name = prefs.nickname || "나";
  const lv = userLevel(xp);
  const { streak } = calcStreak(records, new Date(), keptDays);
  const ranks = useMemo(() => domainRanks(records), [records]);
  const stats = useMemo(() => {
    const eligible = records.filter(r=>r.countsAsStudy !== false);
    const topicIds = [...new Set(eligible.map((r) => r.topicId))];
    const tiers = domainRanks(records).map((d) => d.index);
    const first = eligible.length ? eligible.reduce((a, r) => (r.studiedAt < a ? r.studiedAt : a), eligible[0].studiedAt) : null;
    return {
      topics: topicIds.length,
      best: tiers.length ? Math.max(...tiers) : -1,
      engineers: tiers.filter((i) => i >= 5).length,
      battles: records.filter(isBattleRecord).length,
      since: first ? new Date(first) : null,
    };
  }, [records]);
  const activeTitle = titleById(useCosmetics().title);
  const [extra, setExtra] = useState<AchievementExtra>({});
  useEffect(() => {
    Promise.all([readExamStore(), readDone()]).then(([s, d]) => setExtra({ exams: s.results, solved: Object.keys(d).length }));
  }, []);
  const list = useMemo(
    () => achievements(records, xp, keptDays, { ...extra, questClaims: questClaims.length }),
    [records, xp, keptDays, extra, questClaims],
  );
  const earned = list.filter((a) => a.stage > 0).length;

  const shareUid = () => {
    tap();
    Share.share({ message: `뽑공에서 친구 추가해 줘! 내 UID: ${uid}` }).catch(() => {});
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* 위: 남색 배경 + 큰 프로필 그림 */}
        <View style={{ height: 210, backgroundColor: "#1d2742", overflow: "hidden" }}>
          <ReelPattern />
          <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 16 }}>
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
              <Icon name="close" size={24} color="#fffaf0" />
            </Pressable>
            <Pressable onPress={() => router.navigate("/settings")} hitSlop={10} accessibilityRole="button" accessibilityLabel="설정">
              <Icon name="gear" size={30} />
            </Pressable>
          </View>
          <View style={{ position: "absolute", bottom: -2, alignSelf: "center", alignItems: "center" }}>
            <View style={{
              width: 128, height: 128, borderRadius: 64, backgroundColor: "#f7b500", borderWidth: 6, borderColor: "#fffaf0",
              alignItems: "center", justifyContent: "center", marginBottom: 14, boxShadow: "0px 6px 0px #c98f00",
            }}>
              <T size={56} weight="bold" style={{ color: "#1d2742", lineHeight: 66 }}>{name.slice(0, 1)}</T>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 16, maxWidth: 640, width: "100%", alignSelf: "center" }}>
          {/* 이름 · UID */}
          <View style={{ alignItems: "center", gap: 6, marginTop: 10 }}>
            <T size={26} weight="bold">{name}</T>
            {activeTitle && <TitleBadge t={activeTitle} />}
            <T size={14} color="muted">
              @{uid || "--------"}{stats.since ? ` · ${stats.since.getFullYear()}년 ${stats.since.getMonth() + 1}월부터 공부 중` : ""}
            </T>
            <LevelBadge level={lv.level} />
          </View>

          {/* 숫자 세 개 */}
          <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
            {[
              { v: friends === null ? "-" : String(friends), l: "친구" },
              { v: String(stats.topics), l: "공부한 주제" },
              { v: String(stats.battles), l: "배틀" },
            ].map((x) => (
              <View key={x.l} style={{ alignItems: "center", minWidth: 80 }}>
                <T size={20} weight="bold">{x.v}</T>
                <T size={13} color="muted">{x.l}</T>
              </View>
            ))}
          </View>

          {/* 친구 추가 + UID 공유 */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Btn title="친구 추가하기" icon={<Icon name="user-plus" size={22} color={c.ink} />} onPress={() => router.navigate("/friends")} style={{ flex: 1 }} />
            <Pressable
              onPress={shareUid}
              accessibilityRole="button"
              accessibilityLabel="내 UID 공유"
              style={({ pressed }) => ({
                width: 56, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1.5,
                borderColor: c.line2, backgroundColor: c.paper, ...raised(c.paperEdge, pressed), ...(!pressed ? shadow(c, 1) : null),
              })}
            >
              <Icon name="share" size={24} color={c.ink} />
            </Pressable>
          </View>

          {/* 학습 현황 */}
          <SectionTitle title="학습 현황" />
          <StatGrid>
            <StatTile icon={<Icon name="flame" size={30} />} value={`${streak}일`} label="연속 공부" dim={!streak} />
            <StatTile icon={<Icon name="bolt" size={30} />} value={`${xp.toLocaleString()} XP`} label="누적 경험치" />
            <StatTile icon={<TierIcon index={Math.max(0, stats.best)} size={30} />} value={stats.engineers ? `${stats.engineers}개` : stats.best >= 0 ? ["브론즈", "실버", "골드", "플래티넘", "다이아", "엔지니어"][stats.best] : "-"} label={stats.engineers ? "엔지니어 랭크 분야" : "최고 분야 랭크"} dim={stats.best < 0} />
            <StatTile icon={<Icon name="gear" size={30} />} value={`${gears}개`} label={freezes ? `톱니바퀴 · 보호권 ${freezes}개` : "톱니바퀴"} />
          </StatGrid>

          {/* 분야별 랭크 */}
          {ranks.length > 0 && (
            <>
              <SectionTitle title="분야 랭크" right={<Pressable onPress={() => router.push("/roadmap")} hitSlop={8}><T size={13} weight="semibold" color="accent">로드맵 ›</T></Pressable>} />
              <Card style={{ gap: 14 }}>
                {ranks.map((d) => (
                  <View key={d.domain} style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <DomainIcon id={d.domain} size={26} />
                      <T size={15} weight="bold" style={{ flex: 1 }} numberOfLines={1}>{domainById(d.domain)?.name ?? d.domain}</T>
                      <TierBadge index={d.index} size="sm" />
                    </View>
                    {d.next !== null && <ProgressBar value={d.points} goal={d.next} height={8} color={d.tier?.color} />}
                  </View>
                ))}
              </Card>
            </>
          )}

          {/* 업적 */}
          <SectionTitle title="업적" right={<T size={13} color="muted">{earned} / {list.length}개 획득</T>} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
            {[...list].sort((a, b) => Number(b.stage > 0) - Number(a.stage > 0)).map((a) => <AchievementBadge key={a.id} a={a} size={72} />)}
          </ScrollView>
          {ACHIEVEMENT_GROUPS.map((g) => {
            const items = list.filter((a) => a.group === g.id);
            return (
              <View key={g.id} style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <T size={15} weight="bold" color="ink2">{g.title}</T>
                  <T size={12} color="muted">{items.filter((a) => a.stage > 0).length} / {items.length}</T>
                </View>
                <Card style={{ paddingVertical: 2 }}>
                  {items.map((a, i) => <AchievementRow key={a.id} a={a} last={i === items.length - 1} />)}
                </Card>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
