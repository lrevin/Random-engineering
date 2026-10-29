import { Pressable, View } from "react-native";
import { DOMAIN_GROUPS, DOMAINS, topicCount, type Domain } from "@/data";
import { radius, raised, shadow, useColors } from "@/theme";
import { T, tap } from "./ui";

/** 듀오링고식 분야 고르기: 공학·과학으로 나눠 큰 카드 2열, 여러 개 선택 */
export function DomainPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <View style={{ gap: 18 }}>
      {DOMAIN_GROUPS.map((g) => (
        <View key={g.id} style={{ gap: 10 }}>
          <T size={15} weight="bold" color="ink2">{g.name}</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {DOMAINS.filter((d) => d.available && d.group === g.id).map((d) => (
              <DomainCard key={d.id} d={d} on={value.includes(d.id)} onPress={() => toggle(d.id)} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function DomainCard({ d, on, onPress }: { d: Domain; on: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${d.name}, ${d.description}`}
      onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => ({
        width: "48%", flexGrow: 1, minHeight: 112, padding: 14, gap: 4,
        borderRadius: radius.lg, borderWidth: 2,
        borderColor: on ? c.accent : c.line2,
        backgroundColor: on ? c.accentSoft : c.paper,
        ...raised(on ? c.accentDeep : c.paperEdge, pressed),
        ...(!pressed ? shadow(c, 1) : null),
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
}
