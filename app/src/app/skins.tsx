import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, useColorScheme, View } from "react-native";
import { Icon } from "@/components/Icon";
import { ThemePreview } from "@/components/ThemePreview";
import { GearCount } from "@/components/TimeUpSheet";
import { Badge, Btn, Row, Screen, T } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { BOSS_THEME_ODDS_TEXT } from "@/lib/boss";
import { addTheme, applyTheme, THEMES, useThemes, type ThemeDef } from "@/lib/skins";
import { inset, radius, shadow, useColors } from "@/theme";
import { paletteFor } from "@/themes";

/** 프리미엄 전용 표시에 쓰는 홀로그램 그라데이션 (프리즘 오팔 강조색과 같음) */
const PREMIUM_SHEEN = "linear-gradient(115deg, #ff5fa2 0%, #a14cf5 42%, #5b6ff7 78%, #3f9bf5 100%)";
/** 오답 보스전 전용 테마 테두리: 불꽃 코로나 */
const BOSS_SHEEN = "linear-gradient(120deg, #ffb35c 0%, #ff4d5e 45%, #9b1b6a 100%)";
const grad = (color: string, g: string | null) => (g ? { backgroundColor: color, experimental_backgroundImage: g } : { backgroundColor: color });

/** 테마: 앱 전체 색을 바꾸는 테마 사기 · 바꾸기 (칭호는 titles.tsx) */
export default function Skins() {
  const { mode, walletNotice, refreshWallet, purchaseItem, equipCosmetic, gears, spendGears } = useApp();
  const c = useColors();
  const scheme = useColorScheme();
  const { owned, active, premium } = useThemes();
  const [notice, setNotice] = useState("");
  useEffect(() => { if (mode === "user") void refreshWallet().catch(() => {}); }, [mode, refreshWallet]);

  const buy = async (t: ThemeDef) => {
    if (owned.includes(t.id)) return;
    if (mode === "user") { if (!await purchaseItem("skin:" + t.id)) return; }
    else { if (!await spendGears(t.price)) return; addTheme(t.id); }
    setNotice(`${t.name} 테마를 사서 바로 적용했어요`);
  };
  const use = async (t: ThemeDef) => {
    if (t.premium && !premium) { router.push("/shop"); return; }
    if (mode === "user") { if (!await equipCosmetic("skin", t.id)) return; } else applyTheme(t.id);
    setNotice(`${t.name} 테마로 바꿨어요`);
  };

  const card = (t: ThemeDef) => {
    const p = paletteFor(t.id, scheme);
    const has = t.premium ? premium : owned.includes(t.id);
    const on = active.id === t.id;
    const body = (
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
              {t.premium && !on && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill,
                  backgroundColor: "#7b3ff2", experimental_backgroundImage: PREMIUM_SHEEN }}>
                  <Icon name="crown" size={14} />
                  <T size={11} weight="bold" style={{ color: "#ffffff" }}>프리미엄 전용</T>
                </View>
              )}
              {t.boss && !on && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill,
                  backgroundColor: "#b81f3a", experimental_backgroundImage: BOSS_SHEEN }}>
                  <Icon name="swords" size={14} />
                  <T size={11} weight="bold" style={{ color: "#ffffff" }}>보스전 전용</T>
                </View>
              )}
              {!on && !t.boss && p.mode === "dark" && t.id !== "classic" && <Badge label="어두운 테마" tone="navy" />}
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
          ) : t.boss ? (
            <>
              <Btn title="오답 보스전 하러 가기" size="sm" variant="primary" icon={<Icon name="swords" size={18} />} onPress={() => router.push("/boss")} />
              <T size={12} color="muted">오답 보스전 클리어 보상을 받을 때 {BOSS_THEME_ODDS_TEXT} 확률(1만 번에 1번)로 얻어요. 톱니바퀴로는 살 수 없어요.</T>
            </>
          ) : t.premium ? (
            <>
              <Btn title="뽑공 프리미엄으로 바로 쓰기" size="sm" variant="premium" icon={<Icon name="crown" size={18} />} onPress={() => router.push("/shop")} />
              <T size={12} color="muted">프리미엄을 시작하면 바로 쓸 수 있어요. 톱니바퀴로는 살 수 없어요.</T>
            </>
          ) : (
            <>
              <Btn title={`사기 · 톱니바퀴 ${t.price}개`} size="sm" variant="accent" icon={<Icon name="gear" size={18} />} onPress={() => buy(t)} disabled={gears < t.price} />
              {gears < t.price && <T size={12} color="accent">톱니바퀴가 {t.price - gears}개 부족해요</T>}
            </>
          )}
        </View>
      </View>
    );
    // 프리미엄 전용 테마는 홀로그램 테두리로 감쌈
    if (t.boss) return (
      <View key={t.id} style={{ borderRadius: radius.lg + 3, padding: 3, backgroundColor: "#b81f3a", experimental_backgroundImage: BOSS_SHEEN, ...shadow(c, 2) }}>
        {body}
      </View>
    );
    return t.premium ? (
      <View key={t.id} style={{ borderRadius: radius.lg + 3, padding: 3, backgroundColor: "#7b3ff2", experimental_backgroundImage: PREMIUM_SHEEN, ...shadow(c, 2) }}>
        {body}
      </View>
    ) : body;
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

      {/* 프리미엄 전용 테마를 맨 위에 */}
      <Row gap={6}><Icon name="crown" size={20} /><T size={16} weight="bold">뽑공 프리미엄 전용</T></Row>
      {THEMES.filter((t) => t.premium).map(card)}
      <Row gap={6} style={{ marginTop: 4 }}><Icon name="swords" size={20} /><T size={16} weight="bold">오답 보스전 전용</T></Row>
      {THEMES.filter((t) => t.boss).map(card)}
      <T size={16} weight="bold" style={{ marginTop: 4 }}>톱니바퀴 테마</T>
      {THEMES.filter((t) => !t.premium && !t.boss).map(card)}

    </Screen>
  );
}
