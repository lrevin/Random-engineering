import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import {
  ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { inset, radius, raised, shadow, useColors } from "@/theme";

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
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: FONT[weight], fontSize: size, lineHeight: Math.round(size * 1.45), color: c[color] },
        center && { textAlign: "center" },
        style,
      ]}
    />
  );
}

type BtnProps = {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "accent" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Btn({ title, onPress, variant = "outline", size = "md", disabled, loading, icon, style }: BtnProps) {
  const c = useColors();
  const bg = { primary: c.navy, accent: c.accent, outline: c.paper, ghost: "transparent" }[variant];
  const fg = { primary: c.navyInk, accent: c.accentInk, outline: c.ink, ghost: c.ink2 }[variant];
  const border = { primary: c.navy, accent: c.accent, outline: c.line2, ghost: "transparent" }[variant];
  // 슬롯머신 버튼처럼 아래쪽이 두꺼운 입체 버튼 (누르면 내려감)
  const under = { primary: c.navyDeep, accent: c.accentDeep, outline: c.paperEdge, ghost: "transparent" }[variant];
  const depth = variant === "ghost" ? 0 : variant === "outline" ? 4 : 5;
  const pad = { sm: [7, 14], md: [12, 20], lg: [17, 28] }[size];
  const fs = { sm: 14, md: 16, lg: 19 }[size];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled || loading}
      onPress={() => { tap(); onPress?.(); }}
      style={({ pressed }) => [
        {
          backgroundColor: bg, borderColor: border, borderWidth: variant === "outline" ? 1.5 : 1, borderRadius: size === "lg" ? radius.lg : radius.md,
          ...(depth ? raised(under, pressed && !disabled, depth) : null),
          ...(depth && !pressed && !disabled ? shadow(c, 1) : null),
          paddingVertical: pad[0], paddingHorizontal: pad[1], flexDirection: "row", alignItems: "center",
          justifyContent: "center", gap: 8, opacity: disabled ? 0.45 : pressed ? 0.92 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon}
      <Text style={{ color: fg, fontFamily: FONT.semibold, fontSize: fs }}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, disabled }: { label: string; selected?: boolean; onPress?: () => void; disabled?: boolean }) {
  const c = useColors();
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
      })}
    >
      <Text style={{ fontFamily: FONT.medium, fontSize: 15, color: selected ? c.navyInk : c.ink2 }}>{label}</Text>
    </Pressable>
  );
}

/** 여러 개 중 하나 고르는 분할 버튼 */
export function Segment<V extends string>({ options, value, onChange }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void }) {
  const c = useColors();
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
              paddingVertical: 6, paddingHorizontal: 13, borderRadius: radius.md - 3,
              backgroundColor: on ? c.navy : "transparent", borderBottomWidth: 3, borderBottomColor: on ? c.navyDeep : "transparent",
              ...(on ? shadow(c, 1) : null),
            }}
          >
            <Text style={{ fontFamily: FONT.medium, fontSize: 14, color: on ? c.navyInk : c.ink2 }}>{o.label}</Text>
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

export function Badge({ label, tone = "plain" }: { label: string; tone?: "plain" | "navy" | "accent" | "outline" }) {
  const c = useColors();
  const bg = { plain: c.chip, navy: c.navy, accent: c.accent, outline: "transparent" }[tone];
  const fg = { plain: c.ink2, navy: c.navyInk, accent: c.accentInk, outline: c.ink2 }[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2, borderWidth: tone === "outline" ? 1 : 0, borderColor: c.line2 }}>
      <Text style={{ fontFamily: FONT.medium, fontSize: 13, color: fg }}>{label}</Text>
    </View>
  );
}

export const levelTone = (lv: string) => (lv === "심화" ? "accent" : lv === "중급" ? "navy" : "outline") as "accent" | "navy" | "outline";

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <T size={14} weight="semibold" color="ink2">{label}</T>
      <TextInput
        placeholderTextColor={c.muted}
        {...props}
        style={[
          {
            borderWidth: 1.5, borderColor: error ? c.accent : c.line2, backgroundColor: c.paper, borderRadius: radius.md, ...inset(c),
            paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: c.ink, fontFamily: FONT.regular,
          },
          props.style as StyleProp<TextStyle>,
        ]}
      />
      {error ? <T size={13} color="accent">{error}</T> : null}
    </View>
  );
}

/** 화면 바탕 (안전 영역 + 배경색 + 선택적 스크롤) */
export function Screen({ children, scroll, edges = ["top", "bottom"], contentStyle }: {
  children: ReactNode; scroll?: boolean; edges?: Edge[]; contentStyle?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const inner = [{ paddingHorizontal: 20, paddingVertical: 16, gap: 16, maxWidth: 640, width: "100%" as const, alignSelf: "center" as const }, contentStyle];
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: c.bg }}>
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
