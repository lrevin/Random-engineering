import { Pressable, View } from "react-native";
import { topicCount } from "@/data";
import type { Prefs } from "@/lib/types";
import { radius, raised, shadow, useColors } from "@/theme";
import { T, tap } from "./ui";

const OPTIONS: { value: Prefs["level"]; title: string; body: string; dots: number }[] = [
  { value: 1, title: "Lv.1 기초", body: "처음 배우는 개념부터 차근차근", dots: 1 },
  { value: 2, title: "Lv.2 중급", body: "기본은 알고 있어요. 한 단계 더 깊이", dots: 2 },
  { value: 3, title: "Lv.3 심화", body: "전공 심화 · 기사 시험 수준", dots: 3 },
  { value: 0, title: "골고루 섞기", body: "난이도 상관없이 모두 랜덤으로", dots: 0 },
];

/** 주로 공부할 난이도 고르기 (하나 선택) */
export function LevelPicker({ value, onChange, interests }: {
  value: Prefs["level"]; onChange: (v: Prefs["level"]) => void; interests: string[];
}) {
  const c = useColors();
  return (
    <View style={{ gap: 10 }}>
      {OPTIONS.map((o) => {
        const on = o.value === value;
        const n = topicCount((t) => interests.includes(t.category) && (o.value === 0 || t.lv === o.value));
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => { tap(); onChange(o.value); }}
            style={({ pressed }) => ({
              flexDirection: "row", alignItems: "center", gap: 14, padding: 16,
              borderRadius: radius.lg, borderWidth: 2,
              borderColor: on ? c.accent : c.line2, backgroundColor: on ? c.accentSoft : c.paper,
              ...raised(on ? c.accentDeep : c.paperEdge, pressed),
              ...(!pressed ? shadow(c, 1) : null),
            })}
          >
            <View style={{ flexDirection: "row", gap: 3, width: 46 }}>
              {o.dots === 0 ? (
                <T size={22}>🎲</T>
              ) : (
                [1, 2, 3].map((i) => (
                  <View key={i} style={{ width: 12, height: 6 + i * 6, alignSelf: "flex-end", borderRadius: 3, backgroundColor: i <= o.dots ? c.accent : c.line2 }} />
                ))
              )}
            </View>
            <View style={{ flex: 1 }}>
              <T size={17} weight="bold">{o.title}</T>
              <T size={13} color="muted">{o.body}</T>
            </View>
            <T size={13} color="ink2">{n}개</T>
          </Pressable>
        );
      })}
    </View>
  );
}
