import { Pressable, View } from "react-native";
import { categoryById, domainById, topicCount } from "@/data";
import { radius, raised, shadow, useColors } from "@/theme";
import { T, tap } from "./ui";

export type RelatedItem = { category: string; why: string; from: string };

/** 연관 분야 추천 목록: 세부 분야마다 "왜 함께 보면 좋은지"를 보여 주고 켜고 끔 */
export function RelatedPicker({ items, value, onChange }: {
  items: RelatedItem[]; value: string[]; onChange: (v: string[]) => void;
}) {
  const c = useColors();
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <View style={{ gap: 10 }}>
      {items.map((it) => {
        const cat = categoryById(it.category);
        if (!cat) return null;
        const on = value.includes(it.category);
        const owner = domainById(cat.domain);
        return (
          <Pressable
            key={it.category}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${cat.name}, ${it.why}`}
            onPress={() => { tap(); toggle(it.category); }}
            style={({ pressed }) => ({
              flexDirection: "row", alignItems: "center", gap: 12, padding: 14,
              borderRadius: radius.lg, borderWidth: 2,
              borderColor: on ? c.accent : c.line2, backgroundColor: on ? c.accentSoft : c.paper,
              ...raised(on ? c.accentDeep : c.paperEdge, pressed),
              ...(!pressed ? shadow(c, 1) : null),
            })}
          >
            <T size={26} style={{ lineHeight: 34 }}>{cat.emoji}</T>
            <View style={{ flex: 1, gap: 1 }}>
              <T size={16} weight="bold">{cat.name}</T>
              <T size={13} color="ink2">{it.why}</T>
              <T size={12} color="muted">{owner?.name} · 주제 {topicCount((t) => t.category === it.category)}개 · {domainById(it.from)?.name}에 추천</T>
            </View>
            <View style={{
              width: 24, height: 24, borderRadius: 12, borderWidth: 1.5,
              borderColor: on ? c.accent : c.line2, backgroundColor: on ? c.accent : "transparent",
              alignItems: "center", justifyContent: "center",
            }}>
              {on && <T size={13} weight="bold" color="accentInk">✓</T>}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
