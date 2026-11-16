import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, useColorScheme, View } from "react-native";
import { Icon } from "@/components/Icon";
import { GearCount } from "@/components/TimeUpSheet";
import { Badge, Btn, FONT, Row, Screen, T } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { addTheme, applyTheme, THEMES, useThemes, type ThemeDef } from "@/lib/skins";
import { inset, radius, shadow, useColors } from "@/theme";
import { paletteFor, type Palette } from "@/themes";

const grad = (color: string, g: string | null) => (g ? { backgroundColor: color, experimental_backgroundImage: g } : { backgroundColor: color });

/** 테마 미리 보기: 그 테마의 색으로 그린 작은 홈 화면 (그라데이션 바탕 · 슬롯머신 · 카드 · 강조 버튼) */
function ThemePreview({ p }: { p: Palette }) {
  const reel = (col: string) => <View style={{ flex: 1, height: 22, borderRadius: 6, backgroundColor: col, opacity: 0.92 }} />;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ ...grad(p.bg, p.grad.bg), borderRadius: radius.lg - 4, padding: 14, flexDirection: "row", gap: 14, overflow: "hidden", borderWidth: 1, borderColor: p.line }}
    >
      {/* 미니 슬롯머신 */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ width: 92, height: 112, borderRadius: 16, ...grad(p.slot, p.grad.hero), borderBottomWidth: 5, borderBottomColor: p.slotEdge, padding: 8, gap: 7 }}>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
            {[p.gold, p.accent, p.gold].map((col, i) => <View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: col }} />)}
          </View>
          <View style={{ flex: 1, borderRadius: 10, backgroundColor: p.slotWindow, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6 }}>
            {reel(p.gold)}{reel(p.accent)}{reel(p.gold)}
          </View>
          <View style={{ alignSelf: "center", width: 30, height: 4, borderRadius: 2, backgroundColor: p.slotEdge }} />
        </View>
        <View style={{ width: 16, height: 78, alignItems: "center" }}>
          <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: p.accent }} />
          <View style={{ width: 4, height: 40, backgroundColor: p.lever }} />
          <View style={{ width: 10, height: 4, backgroundColor: p.lever, alignSelf: "flex-start" }} />
        </View>
      </View>

      {/* 카드 + 버튼 */}
      <View style={{ flex: 1, gap: 9, justifyContent: "center" }}>
        <View style={{ backgroundColor: p.paper, borderRadius: 12, borderWidth: 1, borderColor: p.line, borderBottomWidth: 3, borderBottomColor: p.paperEdge, padding: 10, gap: 6 }}>
          <Text style={{ fontFamily: FONT.bold, fontSize: 13, color: p.ink }}>오늘의 주제</Text>
          <Text style={{ fontFamily: FONT.regular, fontSize: 11, color: p.ink2 }}>트랜잭션 ACID</Text>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: p.chip, overflow: "hidden" }}>
            <View style={{ width: "64%", height: "100%", borderRadius: 3, backgroundColor: p.success }} />
          </View>
        </View>
        <View style={{ ...grad(p.accent, p.grad.accent), borderRadius: 12, borderBottomWidth: 3, borderBottomColor: p.accentDeep, paddingVertical: 8, alignItems: "center" }}>
          <Text style={{ fontFamily: FONT.semibold, fontSize: 12, color: p.accentInk }}>주제 뽑기</Text>
        </View>
      </View>
    </View>
  );
}

/** 테마: 앱 전체 색을 바꾸는 테마 사기 · 바꾸기 (칭호는 titles.tsx) */
export default function Skins() {
  const { mode, walletNotice, refreshWallet, purchaseItem, equipCosmetic, gears, spendGears } = useApp();
  const c = useColors();
  const scheme = useColorScheme();
  const { owned, active } = useThemes();
  const [notice, setNotice] = useState("");
  useEffect(() => { if (mode === "user") void refreshWallet().catch(() => {}); }, [mode, refreshWallet]);

  const buy = async (t: ThemeDef) => {
    if (owned.includes(t.id)) return;
    if (mode === "user") { if (!await purchaseItem("skin:" + t.id)) return; }
    else { if (!await spendGears(t.price)) return; addTheme(t.id); }
    setNotice(`${t.name} 테마를 사서 바로 적용했어요`);
  };
  const use = async (t: ThemeDef) => {
    if (mode === "user") { if (!await equipCosmetic("skin", t.id)) return; } else applyTheme(t.id);
    setNotice(`${t.name} 테마로 바꿨어요`);
  };

  const card = (t: ThemeDef) => {
    const p = paletteFor(t.id, scheme);
    const has = owned.includes(t.id);
    const on = active.id === t.id;
    return (
      <View key={t.id} style={{
        gap: 12, padding: 12, borderRadius: radius.lg, borderWidth: 2,
        borderColor: on ? c.accent : c.line, borderBottomWidth: 5, borderBottomColor: on ? c.accentDeep : c.paperEdge,
        backgroundColor: c.paper, ...shadow(c, 1),
      }}>
        <ThemePreview p={p} />
        <View style={{ gap: 6, paddingHorizontal: 4 }}>
          <Row gap={6} style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
            <Row gap={6}>
              <T size={18} weight="bold">{t.name}</T>
              {on && <Badge label="사용 중" tone="accent" />}
              {!on && p.mode === "dark" && t.id !== "classic" && <Badge label="어두운 테마" tone="navy" />}
            </Row>
            <Row gap={5}>
              {[grad(p.bg, p.grad.bg), grad(p.slot, p.grad.hero), grad(p.accent, p.grad.accent), { backgroundColor: p.gold }].map((st, i) => (
                <View key={i} style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: c.line2, ...st }} />
              ))}
            </Row>
          </Row>
          <T size={13} color="ink2">{t.desc}</T>
          {on ? (
            <T size={13} color="success" weight="semibold">지금 쓰고 있는 테마예요</T>
          ) : has ? (
            <Btn title="이 테마 쓰기" size="sm" variant="primary" onPress={() => use(t)} />
          ) : (
            <>
              <Btn title={`사기 · 톱니바퀴 ${t.price}개`} size="sm" variant="accent" icon={<Icon name="gear" size={18} />} onPress={() => buy(t)} disabled={gears < t.price} />
              {gears < t.price && <T size={12} color="accent">톱니바퀴가 {t.price - gears}개 부족해요</T>}
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <Screen scroll>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <T size={26} weight="bold">테마</T>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon name="close" size={24} color={c.muted} />
        </Pressable>
      </Row>
      <T color="ink2">앱 전체 색을 바꿔요. 한 번 사면 계속 쓸 수 있고, 산 테마끼리는 언제든 바꿀 수 있어요.</T>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.chip, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 12, ...inset(c) }}>
        <T size={15} color="ink2">내 톱니바퀴</T>
        <GearCount n={gears} size={18} />
      </View>
      {(walletNotice || notice) ? <T size={14} color="success" weight="semibold" center>{walletNotice || notice}</T> : null}

      {THEMES.map(card)}

    </Screen>
  );
}
