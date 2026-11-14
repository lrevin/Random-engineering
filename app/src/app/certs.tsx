import AsyncStorage from "@react-native-async-storage/async-storage";
import { LOCAL_KEYS } from "@/lib/local-data";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/Icon";
import { ProgressBar } from "@/components/Quests";
import { SectionTitle } from "@/components/StatTile";
import { Badge, Btn, Card, Row, Screen, T, tap } from "@/components/ui";
import { CERTS, type CertDef } from "@/data";
import { useApp } from "@/lib/app-state";
import { readExamStore, subjectTopics, type ExamResult } from "@/lib/exam";
import { dateKey } from "@/lib/stats";
import { radius, useColors } from "@/theme";

const DATES_KEY = LOCAL_KEYS.certDates.key;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

/** 시험일까지 남은 날 (오늘이면 0, 지났으면 음수) */
const daysLeft = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(y, m - 1, d).getTime();
  const n = new Date();
  return Math.round((t - new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime()) / 86400000);
};
const fmtDay = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return `${y}. ${m}. ${d}. (${DOW[new Date(y, m - 1, d).getDay()]})`;
};
const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number);
  return dateKey(new Date(y, m - 1, d + n));
};

/** 자격증 대시보드: 시험일 디데이 · 과목별 진도 · 약한 과목 · 모의고사 점수 추이 */
export default function Certs() {
  const { prefs, records } = useApp();
  const c = useColors();
  const [dates, setDates] = useState<Record<string, string>>({});
  const [results, setResults] = useState<ExamResult[]>([]);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(DATES_KEY).then((raw) => { try { if (raw) setDates(JSON.parse(raw)); } catch { /* 깨졌으면 무시 */ } }).catch(() => {});
    readExamStore().then((s) => setResults(s.results));
  }, []);

  const setDate = (id: string, key: string | null) => {
    const next = { ...dates };
    if (key) next[id] = key;
    else delete next[id];
    setDates(next);
    AsyncStorage.setItem(DATES_KEY, JSON.stringify(next)).catch(() => {});
  };

  const studied = useMemo(() => new Set(records.map((r) => r.topicId)), [records]);
  const mine = CERTS.filter((x) => prefs.interests.includes(x.id));

  const card = (cert: CertDef) => {
    const subjects = cert.subjects.map((s) => {
      const ts = subjectTopics(s.items);
      return { name: s.name, total: ts.length, done: ts.filter((t) => studied.has(t.id)).length };
    });
    const allTotal = subjects.reduce((a, s) => a + s.total, 0);
    const allDone = subjects.reduce((a, s) => a + s.done, 0);
    const mineResults = results.filter((r) => r.certId === cert.id).slice(0, 5).reverse();
    const last = mineResults[mineResults.length - 1];
    // 약한 과목: 최근 모의고사 점수가 가장 낮은 과목 (모의고사를 안 봤으면 진도가 가장 낮은 과목)
    const weak = last
      ? [...last.subjects].sort((a, b) => pct(a.score, a.total) - pct(b.score, b.total))[0]
      : [...subjects].sort((a, b) => pct(a.done, a.total) - pct(b.done, b.total))[0];
    const weakText = last
      ? `${weak.name} · 최근 모의고사 ${pct((weak as ExamResult["subjects"][number]).score, weak.total)}점`
      : `${weak.name} · 진도 ${pct((weak as (typeof subjects)[number]).done, weak.total)}%`;
    const date = dates[cert.id];
    const left = date ? daysLeft(date) : null;
    const isEditing = editing === cert.id;
    const draft = date ?? addDays(dateKey(new Date()), 30);

    return (
      <Card key={cert.id} style={{ gap: 14 }}>
        {/* 이름 + 디데이 */}
        <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
          <Row gap={10} style={{ flexWrap: "nowrap", flex: 1 }}>
            <Icon name="medal" size={36} />
            <View style={{ flex: 1 }}>
              <T size={19} weight="bold">{cert.name}</T>
              <T size={12} color="muted">{date ? `시험일 ${fmtDay(date)}` : "시험일을 정하면 디데이를 보여 줘요"}</T>
            </View>
          </Row>
          <Pressable
            onPress={() => { tap(); setEditing(isEditing ? null : cert.id); }}
            accessibilityRole="button"
            accessibilityLabel="시험일 정하기"
            style={{ borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: left === null ? c.chip : left <= 7 ? c.accent : c.navy }}
          >
            <T size={18} weight="bold" style={{ color: left === null ? c.ink2 : "#ffffff" }}>
              {left === null ? "D-?" : left > 0 ? `D-${left}` : left === 0 ? "D-DAY" : "종료"}
            </T>
          </Pressable>
        </Row>

        {/* 시험일 고르기 */}
        {isEditing && (
          <View style={{ gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: c.chip }}>
            <T size={16} weight="bold" center>{fmtDay(draft)}</T>
            <Row gap={6} style={{ justifyContent: "center" }}>
              {[-7, -1, 1, 7, 30].map((n) => (
                <Btn key={n} title={n > 0 ? `+${n}일` : `${n}일`} size="sm" onPress={() => setDate(cert.id, addDays(draft, n))} />
              ))}
            </Row>
            <Row gap={8} style={{ flexWrap: "nowrap" }}>
              {date && <Btn title="지우기" size="sm" variant="ghost" onPress={() => { setDate(cert.id, null); setEditing(null); }} style={{ flex: 1 }} />}
              <Btn title="저장" size="sm" variant="primary" onPress={() => { setDate(cert.id, draft); setEditing(null); }} style={{ flex: 1 }} />
            </Row>
          </View>
        )}

        {/* 전체 진도 + 과목별 진도 */}
        <View style={{ gap: 8 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <T size={14} weight="bold">과목별 진도</T>
            <T size={13} color="muted">전체 {allDone} / {allTotal}개 주제 · {pct(allDone, allTotal)}%</T>
          </Row>
          {subjects.map((s, i) => (
            <View key={s.name} style={{ gap: 3 }}>
              <T size={13} color="ink2" numberOfLines={1}>{i + 1}과목 · {s.name}</T>
              <ProgressBar value={s.done} goal={s.total} height={10} color={s.done >= s.total ? c.success : c.gold} />
            </View>
          ))}
        </View>

        {/* 약한 과목 */}
        <Row gap={8} style={{ flexWrap: "nowrap", backgroundColor: c.accentSoft, borderRadius: radius.md, padding: 10 }}>
          <Icon name="target" size={22} />
          <T size={13} style={{ flex: 1 }}><T size={13} weight="bold" color="accent">약한 과목 </T>{weakText}</T>
        </Row>

        {/* 모의고사 점수 추이 */}
        <View style={{ gap: 8 }}>
          <T size={14} weight="bold">모의고사 점수 추이</T>
          {mineResults.length ? (
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, height: 110, paddingTop: 4 }}>
              {mineResults.map((r, i) => {
                const p = pct(r.score, r.total);
                return (
                  <View key={r.at + i} style={{ flex: 1, alignItems: "center", gap: 4 }}>
                    <T size={12} weight="bold" color={r.pass ? "success" : "accent"}>{p}</T>
                    <View style={{ width: "70%", height: Math.max(6, p * 0.7), borderRadius: 6, backgroundColor: r.pass ? c.success : c.accent }} />
                    <T size={10} color="muted">{new Date(r.at).getMonth() + 1}/{new Date(r.at).getDate()}</T>
                  </View>
                );
              })}
            </View>
          ) : (
            <T size={13} color="muted">아직 본 모의고사가 없어요.</T>
          )}
          <Row gap={6}><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c.success }} /><T size={11} color="muted">합격권</T><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c.accent, marginLeft: 8 }} /><T size={11} color="muted">불합격권 · 최근 5회</T></Row>
        </View>

        <Row gap={8} style={{ flexWrap: "nowrap" }}>
          <Btn title="모의고사 보기" variant="accent" onPress={() => router.push("/exam")} style={{ flex: 1 }} />
          <Btn title="오답 풀기" onPress={() => router.push("/review")} style={{ flex: 1 }} />
        </Row>
      </Card>
    );
  };

  return (
    <Screen scroll>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <T size={26} weight="bold">자격증</T>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon name="close" size={24} color={c.muted} />
        </Pressable>
      </Row>
      {mine.length ? (
        <>
          <T color="ink2">준비 중인 자격증의 진도와 시험일을 한눈에 봐요. 오른쪽 위 디데이를 눌러 시험일을 정할 수 있어요.</T>
          {mine.map(card)}
        </>
      ) : (
        <Card style={{ alignItems: "center", gap: 10, paddingVertical: 24 }}>
          <Icon name="medal" size={56} />
          <T size={16} weight="bold" center>준비 중인 자격증이 없어요</T>
          <T size={13} color="muted" center>관심 분야에서 자격증을 고르면{"\n"}과목별 진도와 디데이를 보여 줘요.</T>
          <Btn title="자격증 고르기" variant="primary" onPress={() => router.push("/interests")} />
        </Card>
      )}
      <SectionTitle title="바로 가기" />
      <Row gap={8} style={{ flexWrap: "nowrap" }}>
        <Btn title="모의고사" icon={<Icon name="doc" size={20} />} onPress={() => router.push("/exam")} style={{ flex: 1 }} />
        <Btn title="복습" icon={<Icon name="book" size={20} />} onPress={() => router.push("/recall")} style={{ flex: 1 }} />
      </Row>
      {mine.length > 0 && <Badge label="모의고사 결과와 시험일은 이 휴대폰에 저장돼요" tone="outline" />}
    </Screen>
  );
}
