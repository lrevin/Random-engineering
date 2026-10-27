import { Pressable, View } from "react-native";
import { DOMAINS, topicCount } from "@/data";
import { radius, useColors } from "@/theme";
import { T, tap } from "./ui";

/** 듀오링고식 분야 고르기: 큰 카드 2열, 여러 개 선택 */
export function DomainPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const c = useColors();
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {DOMAINS.filter((d) => d.available).map((d) => {
        const on = value.includes(d.id);
        return (
          <Pressable
            key={d.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${d.name}, ${d.description}`}
            onPress={() => { tap(); toggle(d.id); }}
            style={({ pressed }) => ({
              width: "48%", flexGrow: 1, minHeight: 112, padding: 14, gap: 4,
              borderRadius: radius.lg, borderWidth: on ? 2 : 1,
              borderColor: on ? c.accent : c.line2,
              backgroundColor: on ? c.accentSoft : c.paper,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <T size={30} style={{ lineHeight: 38 }}>{d.emoji}</T>
              <View style={{
                width: 22, height: 22, borderRadius: 11, borderWidth: 1.5,
                borderColor: on ? c.accent : c.line2, backgroundColor: on ? c.accent : "transparent",
                alignItems: "center", justifyContent: "center",
              }}>
                {on && <T size={12} weight="bold" color="accentInk">✓</T>}
              </View>
            </View>
            <T size={16} weight="bold">{d.name}</T>
            <T size={12} color="muted" numberOfLines={2}>{d.description}</T>
            <T size={12} color="ink2" weight="medium">주제 {topicCount((t) => t.domain === d.id)}개</T>
          </Pressable>
        );
      })}
    </View>
  );
}
