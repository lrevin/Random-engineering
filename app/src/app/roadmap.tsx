import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { showDialog } from "@/components/Dialog";
import { DomainIcon, Icon } from "@/components/Icon";
import { ProgressBar } from "@/components/Quests";
import { TierBadge } from "@/components/Rank";
import { Chip, Row, Screen, T, tap } from "@/components/ui";
import { categoryById, CERTS, DOMAINS, LEVEL_NAMES, TOPICS, type LevelNum, type Topic } from "@/data";
import { useApp } from "@/lib/app-state";
import { subjectTopics } from "@/lib/exam";
import { domainMastery } from "@/lib/rank";
import { fmtDate } from "@/lib/stats";
import { radius, useColors } from "@/theme";

/** 로드맵 한 칸 묶음: 세부 분야(분야 로드맵) 또는 시험 과목(자격증 로드맵) */
interface Section { id: string; name: string; topics: Topic[] }

const LEVELS: LevelNum[] = [1, 2, 3];

/**
 * 분야 로드맵: 분야(또는 자격증) 안의 주제를 세부 분야별로 기초 → 중급 → 심화 순서로 펼쳐 놓고,
 * 공부한 주제를 칠해 나감. 주제를 누르면 설명과 내 기록을 보여 줌.
 */
export default function Roadmap() {
  const { records, prefs } = useApp();
  const c = useColors();

  // 고를 수 있는 것: 내 관심 분야 → 준비 중인 자격증 → 나머지 분야
  const options = useMemo(() => {
    const mineDomains = [...new Set(prefs.interests.map((id) => categoryById(id)?.domain).filter((d): d is string => !!d))];
    const certs = CERTS.filter((x) => prefs.interests.includes(x.id));
    const rest = DOMAINS.filter((d) => d.available && !mineDomains.includes(d.id));
    return [
      ...mineDomains.map((id) => ({ id, name: DOMAINS.find((d) => d.id === id)?.name ?? id, kind: "domain" as const })),
      ...certs.map((x) => ({ id: x.id, name: x.name, kind: "cert" as const })),
      ...rest.map((d) => ({ id: d.id, name: d.name, kind: "domain" as const })),
    ];
  }, [prefs.interests]);
  const [sel, setSel] = useState(() => options[0]?.id ?? "it");
  const current = options.find((o) => o.id === sel) ?? options[0];

  // 주제별 내 기록 (횟수 · 최고 점수 · 마지막 날)
  const stats = useMemo(() => {
    const m = new Map<string, { n: number; best: number; total: number; last: string }>();
    for (const r of records) {
      const x = m.get(r.topicId) ?? { n: 0, best: 0, total: r.total, last: r.studiedAt };
      x.n++;
      if (r.score >= x.best) { x.best = r.score; x.total = r.total; }
      if (r.studiedAt > x.last) x.last = r.studiedAt;
      m.set(r.topicId, x);
    }
    return m;
  }, [records]);

  const sections: Section[] = useMemo(() => {
    if (!current) return [];
    if (current.kind === "cert") {
      const cert = CERTS.find((x) => x.id === current.id);
      return (cert?.subjects ?? []).map((s, i) => ({ id: `${cert?.id}-${i}`, name: `${i + 1}과목 · ${s.name}`, topics: subjectTopics(s.items) }));
    }
    const d = DOMAINS.find((x) => x.id === current.id);
    return (d?.categories ?? []).map((cat) => ({ id: cat.id, name: cat.name, topics: TOPICS.filter((t) => t.category === cat.id) }));
  }, [current]);

  const all = sections.flatMap((s) => s.topics);
  const uniq = [...new Map(all.map((t) => [t.id, t])).values()];
  const done = uniq.filter((t) => stats.has(t.id)).length;
  const rank = current?.kind === "domain" ? domainMastery(current.id, records) : null;

  const open = (t: Topic) => {
    tap();
    const s = stats.get(t.id);
    showDialog({
      icon: s ? "check" : "book",
      title: t.ko,
      message: `${t.categoryName} · Lv.${t.lv} ${t.level}\n${t.hint}\n\n${s ? `${s.n}번 공부 · 최고 ${s.best}/${s.total} · 마지막 ${fmtDate(s.last)}` : "아직 공부하지 않았어요. 슬롯머신에서 뽑히면 공부할 수 있어요."}`,
      buttons: [{ text: "닫기", style: "cancel" }],
    });
  };

  return (
    <Screen scroll>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <T size={26} weight="bold">로드맵</T>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon name="close" size={24} color={c.muted} />
        </Pressable>
      </Row>
      <T color="ink2">분야마다 기초부터 심화까지 어떤 주제가 있는지 보고, 공부한 주제를 칠해 나가요.</T>

      {/* 분야 · 자격증 고르기 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
        {options.map((o) => (
          <Chip
            key={o.id}
            label={o.name}
            selected={o.id === sel}
            onPress={() => setSel(o.id)}
            icon={o.kind === "cert" ? <Icon name="medal" size={16} /> : <DomainIcon id={o.id} size={18} />}
          />
        ))}
      </ScrollView>

      {/* 전체 진행 */}
      <View style={{ gap: 8, padding: 16, borderRadius: radius.lg, borderWidth: 2, borderColor: c.line, backgroundColor: c.paper }}>
        <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
          <Row gap={8} style={{ flex: 1, flexWrap: "nowrap" }}>
            {current?.kind === "cert" ? <Icon name="medal" size={28} /> : <DomainIcon id={current?.id ?? "it"} size={28} />}
            <T size={18} weight="bold" numberOfLines={1} style={{ flex: 1 }}>{current?.name}</T>
          </Row>
          {rank && <TierBadge index={rank.index} size="sm" />}
        </Row>
        <ProgressBar value={done} goal={Math.max(1, uniq.length)} height={12} color={c.success} />
        <T size={12} color="muted">주제 {uniq.length}개 중 {done}개 공부 · {uniq.length ? Math.round((done / uniq.length) * 100) : 0}%</T>
      </View>

      {/* 세부 분야(과목)별 기초 → 중급 → 심화 */}
      {sections.map((s) => {
        const sDone = s.topics.filter((t) => stats.has(t.id)).length;
        const complete = s.topics.length > 0 && sDone === s.topics.length;
        return (
          <View key={s.id} style={{ borderRadius: radius.lg, borderWidth: 2, borderColor: complete ? c.success : c.line, backgroundColor: c.paper, overflow: "hidden" }}>
            <View style={{ padding: 14, gap: 6, backgroundColor: complete ? c.successSoft : c.chip }}>
              <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                <T size={16} weight="bold" style={{ flex: 1 }} numberOfLines={1}>{s.name}</T>
                <T size={13} weight="bold" color={complete ? "success" : "ink2"}>{sDone} / {s.topics.length}</T>
              </Row>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: c.line, overflow: "hidden" }}>
                <View style={{ width: `${s.topics.length ? (sDone / s.topics.length) * 100 : 0}%`, height: "100%", backgroundColor: c.success }} />
              </View>
            </View>

            <View style={{ padding: 14, gap: 4 }}>
              {LEVELS.map((lv, li) => {
                const ts = s.topics.filter((t) => t.lv === lv);
                if (!ts.length) return null;
                const lvDone = ts.filter((t) => stats.has(t.id)).length;
                return (
                  <View key={lv} style={{ flexDirection: "row", gap: 10 }}>
                    {/* 단계 표시: 점과 이어지는 선 */}
                    <View style={{ alignItems: "center", width: 22 }}>
                      <View style={{
                        width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center",
                        backgroundColor: lvDone === ts.length ? c.success : lvDone ? c.gold : c.line2,
                      }}>
                        <T size={11} weight="bold" style={{ color: "#ffffff" }}>{lv}</T>
                      </View>
                      {li < 2 && s.topics.some((t) => t.lv > lv) && <View style={{ flex: 1, width: 2, backgroundColor: c.line2, marginVertical: 2 }} />}
                    </View>
                    <View style={{ flex: 1, gap: 6, paddingBottom: 12 }}>
                      <T size={13} weight="semibold" color="ink2">Lv.{lv} {LEVEL_NAMES[lv]} · {lvDone}/{ts.length}</T>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        {ts.map((t) => {
                          const st = stats.get(t.id);
                          return (
                            <Pressable
                              key={t.id}
                              onPress={() => open(t)}
                              accessibilityRole="button"
                              accessibilityLabel={`${t.ko}${st ? ", 공부함" : ""}`}
                              style={({ pressed }) => ({
                                flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5,
                                borderRadius: radius.pill, borderWidth: 1.5,
                                borderColor: st ? c.success : c.line2,
                                backgroundColor: st ? c.successSoft : pressed ? c.chip : c.paper,
                              })}
                            >
                              {st && <Icon name="check" size={12} color={c.success} />}
                              <T size={13} weight={st ? "semibold" : "regular"} color={st ? "success" : "ink2"}>{t.ko}</T>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </Screen>
  );
}
