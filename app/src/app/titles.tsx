import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/Icon";
import { TitleBadge } from "@/components/TitleBadge";
import { Badge, Btn, Row, Screen, T } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { achievements, type AchievementExtra } from "@/lib/achievements";
import { readExamStore } from "@/lib/exam";
import { applyTitle, TITLES, titleById, useCosmetics, type TitleDef } from "@/lib/skins";
import { radius, shadow, useColors } from "@/theme";

/** 칭호: 연속 기록 보상 · 업적으로 받은 칭호를 모아 보고 프로필에 달기 (팔지 않음) */
export default function Titles() {
  const { mode, walletNotice, refreshWallet, equipCosmetic, records, xp, keptDays } = useApp();
  const c = useColors();
  const cos = useCosmetics();
  const [notice, setNotice] = useState("");
  const [extra, setExtra] = useState<AchievementExtra>({});
  useEffect(() => { readExamStore().then((s) => setExtra({ exams: s.results })); }, []);
  const ach = useMemo(() => achievements(records, xp, keptDays, extra), [records, xp, keptDays, extra]);
  useEffect(() => { if (mode === "user") void refreshWallet().catch(() => {}); }, [mode, refreshWallet]);

  /** 칭호를 쓸 수 있는지: 보상으로 받았거나 업적을 깼거나 */
  const hasTitle = (t: TitleDef) => {
    if (cos.titles.includes(t.id)) return true;
    if (mode === "user") return false;
    const src = t.source;
    return src.kind === "achievement" && (ach.find((a) => a.id === src.id)?.stage ?? 0) >= src.stage;
  };
  const wear = async (id: string | null) => {
    if (mode === "user") { if (!await equipCosmetic("title", id)) return; } else applyTitle(id);
    setNotice(id ? `칭호 "${titleById(id)?.name ?? ""}"을 달았어요` : "칭호를 뗐어요");
  };

  const current = titleById(cos.title);
  const owned = TITLES.filter(hasTitle);
  const locked = TITLES.filter((t) => !hasTitle(t));

  const row = (t: TitleDef) => {
    const has = hasTitle(t);
    const on = cos.title === t.id;
    return (
      <View key={t.id} style={{
        gap: 12, padding: 18, borderRadius: radius.lg, borderWidth: 2,
        borderColor: on ? c.accent : c.line, borderBottomWidth: 5, borderBottomColor: on ? c.accentDeep : c.paperEdge,
        backgroundColor: c.paper, ...shadow(c, 1),
      }}>
        <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
          <View style={{ flexShrink: 1, alignItems: "flex-start" }}><TitleBadge t={t} size={19} dim={!has} /></View>
          {on ? <Badge label="사용 중" tone="accent" /> : !has ? <Icon name="lock" size={24} color={c.muted} /> : null}
        </Row>
        <T size={15} color={has ? "ink2" : "muted"}>{has ? t.desc : `${t.desc}을 이루면 받아요`}</T>
        {has && !on && <Btn title="이 칭호 달기" size="md" variant="primary" onPress={() => { void wear(t.id); }} />}
      </View>
    );
  };

  return (
    <Screen scroll>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <T size={26} weight="bold">칭호</T>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon name="close" size={24} color={c.muted} />
        </Pressable>
      </Row>
      <T color="ink2">연속 기록 보상과 업적으로 받은 칭호를 프로필 닉네임 옆에 달 수 있어요.</T>

      {/* 지금 단 칭호 */}
      <View style={{ alignItems: "center", gap: 12, padding: 22, borderRadius: radius.lg, backgroundColor: c.chip, borderWidth: 1, borderColor: c.line }}>
        <T size={14} color="muted" weight="semibold">지금 단 칭호</T>
        {current ? <TitleBadge t={current} size={24} /> : <T size={18} weight="bold" color="muted">아직 단 칭호가 없어요</T>}
        {current && (
          <Pressable onPress={() => { void wear(null); }} hitSlop={8} accessibilityRole="button">
            <T size={14} color="accent" weight="semibold">칭호 떼기</T>
          </Pressable>
        )}
      </View>
      {(walletNotice || notice) ? <T size={14} color="success" weight="semibold" center>{walletNotice || notice}</T> : null}

      <T size={18} weight="bold">받은 칭호 {owned.length}개</T>
      {owned.length ? owned.map(row) : <T size={14} color="muted">아직 받은 칭호가 없어요. 연속으로 공부하거나 업적을 깨 보세요.</T>}

      {locked.length > 0 && <T size={18} weight="bold">아직 못 받은 칭호 {locked.length}개</T>}
      {locked.map(row)}
    </Screen>
  );
}
