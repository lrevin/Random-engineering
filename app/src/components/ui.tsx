import * as Haptics from "expo-haptics";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { inset, radius, raised, screenBg, shadow, useColors } from "@/theme";
import { Icon } from "./Icon";
import { MAX_FONT_SCALE, useScale } from "@/lib/responsive";

/** 글자 크기를 화면 폭 · 시스템 글자 크기에 맞춤 (lib/responsive.ts) */
const fit = (size: number, k: number) => Math.round(size * k * 2) / 2;

export const FONT = {
  regular: "IBMPlexSansKR_400Regular",
  medium: "IBMPlexSansKR_500Medium",
  semibold: "IBMPlexSansKR_600SemiBold",
  bold: "IBMPlexSansKR_700Bold",
};

export const tap = () => {
  if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
};

type TProps = TextProps & {
  size?: number;
  weight?: keyof typeof FONT;
  color?: "ink" | "ink2" | "muted" | "accent" | "navyInk" | "accentInk" | "flame" | "success" | "gold";
  center?: boolean;
};

/** 앱 전체에서 쓰는 글자 컴포넌트 (한글 폰트 적용) */
export function T({ size = 16, weight = "regular", color = "ink", center, style, ...rest }: TProps) {
  const c = useColors();
  const fs = fit(size, useScale().text);
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      {...rest}
      style={[
        { fontFamily: FONT[weight], fontSize: fs, lineHeight: Math.round(fs * 1.45), color: c[color] },
        center && { textAlign: "center" },
        style,
      ]}
    />
  );
}

type BtnProps = {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "accent" | "outline" | "ghost" | "premium";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Btn({ title, onPress, variant = "outline", size = "md", disabled, loading, icon, style }: BtnProps) {
  const c = useColors();
  const bg = { primary: c.navy, accent: c.accent, outline: c.paper, ghost: "transparent", premium: "#7d4bc7" }[variant];
  const fg = { primary: c.navyInk, accent: c.accentInk, outline: c.ink, ghost: c.ink2, premium: "#ffffff" }[variant];
  const border = { primary: c.navy, accent: c.accent, outline: c.line2, ghost: "transparent", premium: "#7d4bc7" }[variant];
  // 슬롯머신 버튼처럼 아래쪽이 두꺼운 입체 버튼 (누르면 내려감)
  const under = { primary: c.navyDeep, accent: c.accentDeep, outline: c.paperEdge, ghost: "transparent", premium: "#55309a" }[variant];
  const depth = variant === "ghost" ? 0 : variant === "outline" ? 4 : 5;
  const k = useScale();
  const pad = { sm: [7, 14], md: [12, 20], lg: [17, k.narrow ? 20 : 28] }[size];
  const fs = fit({ sm: 14, md: 16, lg: 19 }[size], k.text);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled || loading}
      onPress={() => { tap(); onPress?.(); }}
      style={({ pressed }) => [
        {
          backgroundColor: bg, borderColor: border, borderWidth: variant === "outline" ? 1.5 : 1, borderRadius: size === "lg" ? radius.lg : radius.md,
          // 테마에 그라데이션이 있으면 강조 버튼만 그라데이션 (테두리는 안 보이게)
          ...(variant === "accent" && c.grad.accent ? { experimental_backgroundImage: c.grad.accent, borderColor: "transparent" } : null),
          ...(depth ? raised(under, pressed && !disabled, depth) : null),
          ...(depth && !pressed && !disabled ? shadow(c, 1) : null),
          paddingVertical: pad[0], paddingHorizontal: pad[1], flexDirection: "row", alignItems: "center",
          justifyContent: "center", gap: 8, opacity: disabled ? 0.45 : pressed ? 0.92 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon}
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={2} style={{ color: fg, fontFamily: FONT.semibold, fontSize: fs, textAlign: "center", flexShrink: 1 }}>{title}</Text>
    </Pressable>
  );
}

/** 나란히 놓는 알약 버튼 크기 (홈의 난이도 버튼과 '많이 푼 주제 포함'이 같은 크기) */
export const PILL_FILL: ViewStyle = { flex: 1, height: 54, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 };

export function Chip({ label, selected, onPress, disabled, fill, icon }: { label: string; selected?: boolean; onPress?: () => void; disabled?: boolean; fill?: boolean; icon?: ReactNode }) {
  const c = useColors();
  const k = useScale().text;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => { tap(); onPress?.(); }}
      style={({ pressed }) => ({
        borderWidth: 1.5, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 14,
        borderColor: selected ? c.navy : c.line2, backgroundColor: selected ? c.navy : c.paper,
        ...raised(selected ? c.navyDeep : c.paperEdge, pressed && !disabled, 3),
        ...(!pressed ? shadow(c, 1) : null),
        opacity: disabled ? 0.4 : 1,
        ...(fill ? PILL_FILL : null),
        ...(icon ? { flexDirection: "row", alignItems: "center", gap: 6 } : null),
      })}
    >
      {icon}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={{ fontFamily: fill ? FONT.semibold : FONT.medium, fontSize: fit(fill ? 16 : 15, k), color: selected ? c.navyInk : c.ink2, flexShrink: 1 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** 여러 개 중 하나 고르는 분할 버튼 */
/** 고르기 버튼 줄. fill이면 칸을 똑같이 나눠 가로를 꽉 채움 */
export function Segment<V extends string>({ options, value, onChange, fill }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void; fill?: boolean }) {
  const c = useColors();
  const k = useScale();
  return (
    <View style={{ flexDirection: "row", borderRadius: radius.md, backgroundColor: c.chip, padding: 3, gap: 2, ...inset(c) }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => { tap(); onChange(o.value); }}
            style={{
              paddingVertical: fill ? 9 : 6, paddingHorizontal: k.narrow ? 8 : 13, borderRadius: radius.md - 3,
              ...(fill ? { flex: 1, alignItems: "center" as const } : null),
              backgroundColor: on ? c.navy : "transparent", borderBottomWidth: 3, borderBottomColor: on ? c.navyDeep : "transparent",
              ...(on ? shadow(c, 1) : null),
            }}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={MAX_FONT_SCALE} style={{ fontFamily: on && fill ? FONT.semibold : FONT.medium, fontSize: fit(fill ? 15 : 14, k.text), color: on ? c.navyInk : c.ink2 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Card({ children, style, accent }: { children: ReactNode; style?: StyleProp<ViewStyle>; accent?: boolean }) {
  const c = useColors();
  return (
    <View
      style={[
        { backgroundColor: c.paper, borderColor: c.line, borderWidth: 1, borderBottomWidth: 3, borderBottomColor: c.paperEdge, borderRadius: radius.lg, padding: 18, ...shadow(c, 2) },
        accent && { borderTopWidth: 4, borderTopColor: c.gold },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Badge({ label, tone = "plain", icon }: { label: string; tone?: "plain" | "navy" | "accent" | "outline"; icon?: ReactNode }) {
  const c = useColors();
  const bg = { plain: c.chip, navy: c.navy, accent: c.accent, outline: "transparent" }[tone];
  const fg = { plain: c.ink2, navy: c.navyInk, accent: c.accentInk, outline: c.ink2 }[tone];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: bg, borderRadius: radius.pill, paddingLeft: icon ? 4 : 10, paddingRight: 10, paddingVertical: 2, borderWidth: tone === "outline" ? 1 : 0, borderColor: c.line2 }}>
      {icon}
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={{ fontFamily: FONT.medium, fontSize: 13, color: fg }}>{label}</Text>
    </View>
  );
}

export const levelTone = (lv: string) => (lv === "심화" ? "accent" : lv === "중급" ? "navy" : "outline") as "accent" | "navy" | "outline";

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const c = useColors();
  // 비밀번호 칸이면 오른쪽에 눈 버튼: 누르면 입력한 글자를 보여 주고 다시 누르면 가림
  const secret = !!props.secureTextEntry;
  const [shown, setShown] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <T size={14} weight="semibold" color="ink2">{label}</T>
      <View style={{ justifyContent: "center" }}>
        <TextInput
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          placeholderTextColor={c.muted}
          {...props}
          secureTextEntry={secret && !shown}
          style={[
            {
              borderWidth: 1.5, borderColor: error ? c.accent : c.line2, backgroundColor: c.paper, borderRadius: radius.md, ...inset(c),
              paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: c.ink, fontFamily: FONT.regular,
            },
            secret ? { paddingRight: 52 } : null,
            props.style as StyleProp<TextStyle>,
          ]}
        />
        {secret && (
          <Pressable
            onPress={() => setShown((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={shown ? "비밀번호 숨기기" : "비밀번호 보기"}
            style={{ position: "absolute", right: 6, width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
          >
            <Icon name={shown ? "eye-off" : "eye"} size={22} color={c.muted} />
          </Pressable>
        )}
      </View>
      {error ? <T size={13} color="accent">{error}</T> : null}
    </View>
  );
}

/** 화면 바탕 (안전 영역 + 배경색 + 선택적 스크롤) */
export function Screen({ children, scroll, edges = ["top", "bottom"], contentStyle }: {
  children: ReactNode; scroll?: boolean; edges?: Edge[]; contentStyle?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  // 좁은 폰(360dp 등)은 옆 여백을 줄여 내용이 덜 잘리게
  const { narrow } = useScale();
  const inner = [{ paddingHorizontal: narrow ? 14 : 20, paddingVertical: 16, gap: narrow ? 14 : 16, maxWidth: 640, width: "100%" as const, alignSelf: "center" as const }, contentStyle];
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, ...screenBg(c) }}>
      {scroll ? (
        <ScrollView contentContainerStyle={inner} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Row({ children, gap = 8, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap, flexWrap: "wrap" }, style]}>{children}</View>;
}

export const hairline = StyleSheet.hairlineWidth;
