import { Pressable, View } from "react-native";
import { DOMAINS, TOPICS } from "@/data";
import { radius, useColors } from "@/theme";
import { Chip, Row, T, tap } from "./ui";

const countBy = (cat: string) => TOPICS.filter((t) => t.category === cat).length;

/** 관심 분야 고르기 (회원가입·설정에서 함께 사용) */
export function InterestPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const c = useColors();
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <View style={{ gap: 18 }}>
      {DOMAINS.map((d) => {
        const ids = d.categories.map((x) => x.id);
        const all = ids.length > 0 && ids.every((id) => value.includes(id));
        return (
          <View key={d.id} style={{ gap: 10 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <T size={17} weight="bold">{d.emoji} {d.name}</T>
                <T size={13} color="muted">{d.description}</T>
              </View>
              {d.available ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    tap();
                    onChange(all ? value.filter((x) => !ids.includes(x)) : [...new Set([...value, ...ids])]);
                  }}
                  hitSlop={8}
                >
                  <T size={14} weight="semibold" color="accent">{all ? "전체 해제" : "전체 선택"}</T>
                </Pressable>
              ) : (
                <View style={{ borderWidth: 1, borderColor: c.line2, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2 }}>
                  <T size={12} color="muted">준비 중</T>
                </View>
              )}
            </Row>
            {d.available && (
              <Row gap={8}>
                {d.categories.map((cat) => (
                  <Chip
                    key={cat.id}
                    label={`${cat.emoji} ${cat.name} ${countBy(cat.id)}`}
                    selected={value.includes(cat.id)}
                    onPress={() => toggle(cat.id)}
                  />
                ))}
              </Row>
            )}
          </View>
        );
      })}
    </View>
  );
}
