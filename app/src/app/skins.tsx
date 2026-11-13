import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/Icon";
import { GearCount } from "@/components/TimeUpSheet";
import { SectionTitle } from "@/components/StatTile";
import { Badge, Btn, Row, Screen, T } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { achievements, type AchievementExtra } from "@/lib/achievements";
import { readExamStore } from "@/lib/exam";
import {
  addSkin, addTitle, applySkin, applyTitle, inSeason, SKINS, TITLES, titleInSeason, useCosmetics, useSkins,
  type SlotSkin, type TitleDef,
} from "@/lib/skins";
import { inset, radius, shadow, useColors } from "@/theme";

/** 작은 슬롯머신 그림 (스킨 색 미리 보기) */
function SkinPreview({ skin, size = 92 }: { skin: SlotSkin; size?: number }) {
  const c = useColors();
  const body = skin.body ?? c.slot;
  const edge = skin.edge ?? c.slotEdge;
  const lever = skin.lever ?? c.lever;
  const knob = skin.knob ?? c.accent;
  const pointer = skin.pointer ?? c.gold;
  const lights = skin.lights ? [skin.lights[0], skin.lights[1], skin.lights[0]] : [c.gold, c.accent, c.gold];
  const u = size / 92;
  return (
    <View style={{ width: size, height: size, flexDirection: "row", alignItems: "center" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ width: 70 * u, height: 84 * u, borderRadius: 14 * u, backgroundColor: body, borderBottomWidth: 5 * u, borderBottomColor: edge, padding: 7 * u, gap: 5 * u }}>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 5 * u }}>
          {lights.map((col, i) => <View key={i} style={{ width: 6 * u, height: 6 * u, borderRadius: 3 * u, backgroundColor: col }} />)}
        </View>
        <View style={{ flex: 1, borderRadius: 8 * u, backgroundColor: c.slotWindow, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ width: 0, height: 0, borderTopWidth: 4 * u, borderBottomWidth: 4 * u, borderLeftWidth: 6 * u, borderTopColor: "transparent", borderBottomColor: "transparent", borderLeftColor: pointer }} />
          <View style={{ width: 26 * u, height: 5 * u, borderRadius: 3 * u, backgroundColor: c.line2 }} />
          <View style={{ width: 0, height: 0, borderTopWidth: 4 * u, borderBottomWidth: 4 * u, borderRightWidth: 6 * u, borderTopColor: "transparent", borderBottomColor: "transparent", borderRightColor: pointer }} />
        </View>
        <View style={{ alignSelf: "center", width: 22 * u, height: 3 * u, borderRadius: 2 * u, backgroundColor: edge }} />
      </View>
      <View style={{ width: 22 * u, height: 60 * u, alignItems: "center" }}>
        <View style={{ width: 14 * u, height: 14 * u, borderRadius: 7 * u, backgroundColor: knob }} />
        <View style={{ width: 4 * u, height: 30 * u, backgroundColor: lever }} />
        <View style={{ width: 12 * u, height: 4 * u, backgroundColor: lever, alignSelf: "flex-start" }} />
      </View>
    </View>
  );
}

/** 칭호 배지 (프로필 등에서도 씀) */
export function TitleBadge({ t, size = 13 }: { t: TitleDef; size?: number }) {
  return (
    <View style={{ alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: t.color }}>
      <Icon name="medal" size={size + 3} />
      <T size={size} weight="bold" style={{ color: "#ffffff" }}>{t.name}</T>
    </View>
  );
}

/** 꾸미기: 슬롯머신 스킨(일반 · 시즌 한정 · 연속 기록 보상) + 칭호 */
export default function Skins() {
  const { gears, spendGears, records, xp, keptDays } = useApp();
  const c = useColors();
  const { owned, active } = useSkins();
  const cos = useCosmetics();
  const [notice, setNotice] = useState("");
  const [extra, setExtra] = useState<AchievementExtra>({});
  useEffect(() => { readExamStore().then((s) => setExtra({ exams: s.results })); }, []);
  const ach = useMemo(() => achievements(records, xp, keptDays, extra), [records, xp, keptDays, extra]);

  const buy = async (s: SlotSkin) => {
    if (owned.includes(s.id) || !inSeason(s) || !await spendGears(s.price)) return;
    addSkin(s.id);
    setNotice(`${s.name} 스킨을 사서 바로 적용했어요`);
  };
  const use = (s: SlotSkin) => {
    applySkin(s.id);
    setNotice(`${s.name} 스킨으로 바꿨어요`);
  };

  /** 칭호를 쓸 수 있는지: 받았거나(보상·구매) 업적을 깼거나 */
  const hasTitle = (t: TitleDef) => {
    if (cos.titles.includes(t.id)) return true;
    const src = t.source;
    return src.kind === "achievement" && (ach.find((a) => a.id === src.id)?.stage ?? 0) >= src.stage;
  };
  const buyTitle = async (t: TitleDef) => {
    if (t.source.kind !== "season" || !titleInSeason(t) || !await spendGears(t.source.price)) return;
    addTitle(t.id);
    applyTitle(t.id);
    setNotice(`칭호 "${t.name}"을 사서 바로 달았어요`);
  };

  const card = (s: SlotSkin) => {
    const has = owned.includes(s.id);
    const on = active.id === s.id;
    const src = s.source;
    return (
      <View key={s.id} style={{
        flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: radius.lg, borderWidth: 2,
        borderColor: on ? c.accent : c.line, borderBottomWidth: 5, borderBottomColor: on ? c.accentDeep : c.paperEdge,
        backgroundColor: c.paper, ...shadow(c, 1),
      }}>
        <View style={{ opacity: has || src.kind !== "streak" ? 1 : 0.45 }}><SkinPreview skin={s} /></View>
        <View style={{ flex: 1, gap: 6 }}>
          <Row gap={6}>
            <T size={18} weight="bold">{s.name}</T>
            {on && <Badge label="사용 중" tone="accent" />}
            {!on && src.kind === "season" && <Badge label="한정" tone="navy" />}
          </Row>
          <T size={13} color="ink2">{s.desc}</T>
          {on ? (
            <T size={13} color="success" weight="semibold">지금 쓰고 있는 스킨이에요</T>
          ) : has ? (
            <Btn title="이 스킨 쓰기" size="sm" variant="primary" onPress={() => use(s)} />
          ) : src.kind === "streak" ? (
            <Row gap={6} style={{ flexWrap: "nowrap" }}><Icon name="lock" size={16} color={c.muted} /><T size={13} color="muted" style={{ flex: 1 }}>연속 {src.days}일을 달성하면 퀘스트 화면에서 받아요</T></Row>
          ) : src.kind === "season" && !inSeason(s) ? (
            <Row gap={6} style={{ flexWrap: "nowrap" }}><Icon name="clock" size={16} /><T size={13} color="muted" style={{ flex: 1 }}>{src.label}에 상점에 나와요</T></Row>
          ) : (
            <>
              <Btn title={`사기 · 톱니바퀴 ${s.price}개`} size="sm" variant="accent" icon={<Icon name="gear" size={18} />} onPress={() => buy(s)} disabled={gears < s.price} />
              {gears < s.price && <T size={12} color="accent">톱니바퀴가 {s.price - gears}개 부족해요</T>}
            </>
          )}
        </View>
      </View>
    );
  };

  const season = SKINS.filter((s) => s.source.kind === "season");
  return (
    <Screen scroll>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <T size={26} weight="bold">스킨 · 칭호</T>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon name="close" size={24} color={c.muted} />
        </Pressable>
      </Row>
      <T color="ink2">공부 탭의 슬롯머신 색을 바꾸고, 프로필에 칭호를 달아요. 한 번 얻으면 계속 쓸 수 있어요.</T>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.chip, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 12, ...inset(c) }}>
        <T size={15} color="ink2">내 톱니바퀴</T>
        <GearCount n={gears} size={18} />
      </View>
      {notice ? <T size={14} color="success" weight="semibold" center>{notice}</T> : null}

      <SectionTitle title="시즌 한정 스킨" right={<T size={12} color="muted">기간이 지나면 못 사요</T>} />
      {[...season].sort((a, b) => Number(inSeason(b)) - Number(inSeason(a))).map(card)}

      <SectionTitle title="스킨" />
      {SKINS.filter((s) => s.source.kind === "shop").map(card)}

      <SectionTitle title="연속 기록 보상 스킨" />
      {SKINS.filter((s) => s.source.kind === "streak").map(card)}

      <SectionTitle
        title="칭호"
        right={cos.title ? (
          <Pressable onPress={() => { applyTitle(null); setNotice("칭호를 뗐어요"); }} hitSlop={8}>
            <T size={13} color="accent" weight="semibold">칭호 떼기</T>
          </Pressable>
        ) : undefined}
      />
      <View style={{ borderRadius: radius.lg, borderWidth: 2, borderColor: c.line, backgroundColor: c.paper, overflow: "hidden" }}>
        {TITLES.map((t, i) => {
          const has = hasTitle(t);
          const on = cos.title === t.id;
          const src = t.source;
          return (
            <View key={t.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line, opacity: has || src.kind === "season" ? 1 : 0.6 }}>
              <View style={{ flex: 1, gap: 4, alignItems: "flex-start" }}>
                <View style={{ alignSelf: "flex-start" }}><TitleBadge t={t} /></View>
                <T size={12} color="muted">{t.desc}</T>
              </View>
              {on ? (
                <Badge label="사용 중" tone="accent" />
              ) : has ? (
                <Btn title="달기" size="sm" variant="primary" onPress={() => { applyTitle(t.id); setNotice(`칭호 "${t.name}"을 달았어요`); }} />
              ) : src.kind === "season" && titleInSeason(t) ? (
                <Btn title={`${src.price}개`} size="sm" variant="accent" icon={<Icon name="gear" size={16} />} onPress={() => buyTitle(t)} disabled={gears < src.price} />
              ) : src.kind === "season" ? (
                <T size={12} color="muted">{src.label}</T>
              ) : (
                <Icon name="lock" size={20} color={c.muted} />
              )}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
