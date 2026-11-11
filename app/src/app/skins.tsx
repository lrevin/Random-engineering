import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/Icon";
import { GearCount } from "@/components/TimeUpSheet";
import { Badge, Btn, Row, Screen, T } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { addSkin, applySkin, SKINS, useSkins, type SlotSkin } from "@/lib/skins";
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

/** 슬롯머신 스킨: 톱니바퀴로 사서 홈의 슬롯머신 색을 바꿈 */
export default function Skins() {
  const { gears, spendGears } = useApp();
  const c = useColors();
  const { owned, active } = useSkins();
  const [notice, setNotice] = useState("");

  const buy = (s: SlotSkin) => {
    if (owned.includes(s.id) || !spendGears(s.price)) return;
    addSkin(s.id);
    setNotice(`${s.name} 스킨을 사서 바로 적용했어요`);
  };
  const use = (s: SlotSkin) => {
    applySkin(s.id);
    setNotice(`${s.name} 스킨으로 바꿨어요`);
  };

  return (
    <Screen scroll>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <T size={26} weight="bold">슬롯머신 스킨</T>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon name="close" size={24} color={c.muted} />
        </Pressable>
      </Row>
      <T color="ink2">공부 탭의 슬롯머신 색을 바꿔요. 한 번 사면 계속 쓸 수 있어요.</T>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.chip, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 12, ...inset(c) }}>
        <T size={15} color="ink2">내 톱니바퀴</T>
        <GearCount n={gears} size={18} />
      </View>
      {notice ? <T size={14} color="success" weight="semibold" center>{notice}</T> : null}

      {SKINS.map((s) => {
        const has = owned.includes(s.id);
        const on = active.id === s.id;
        return (
          <View key={s.id} style={{
            flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: radius.lg, borderWidth: 2,
            borderColor: on ? c.accent : c.line, borderBottomWidth: 5, borderBottomColor: on ? c.accentDeep : c.paperEdge,
            backgroundColor: c.paper, ...shadow(c, 1),
          }}>
            <SkinPreview skin={s} />
            <View style={{ flex: 1, gap: 6 }}>
              <Row gap={6}>
                <T size={18} weight="bold">{s.name}</T>
                {on && <Badge label="사용 중" tone="accent" />}
              </Row>
              <T size={13} color="ink2">{s.desc}</T>
              {on ? (
                <T size={13} color="success" weight="semibold">지금 쓰고 있는 스킨이에요</T>
              ) : has ? (
                <Btn title="이 스킨 쓰기" size="sm" variant="primary" onPress={() => use(s)} />
              ) : (
                <>
                  <Btn title={`사기 · 톱니바퀴 ${s.price}개`} size="sm" variant="accent" icon={<Icon name="gear" size={18} />} onPress={() => buy(s)} disabled={gears < s.price} />
                  {gears < s.price && <T size={12} color="accent">톱니바퀴가 {s.price - gears}개 부족해요</T>}
                </>
              )}
            </View>
          </View>
        );
      })}
    </Screen>
  );
}
