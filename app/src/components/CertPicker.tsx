import { Pressable, View } from "react-native";
import { CERTS, certTopics, isCertId } from "@/data";
import { radius, raised, shadow, useColors } from "@/theme";
import { T, tap } from "./ui";
import { Icon } from "./Icon";

/**
 * 취득하려는 자격증 고르기 (회원가입·설정에서 함께 사용).
 * value 는 관심 분야 전체 목록이고, 여기서는 자격증 id("cert-…")만 켜고 끕니다.
 */
export function CertPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const c = useColors();
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <View style={{ gap: 10 }}>
      {CERTS.map((cert) => {
        const on = value.includes(cert.id);
        const n = certTopics(cert.id).length;
        return (
          <Pressable
            key={cert.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${cert.name}, ${cert.org}, 주제 ${n}개`}
            onPress={() => { tap(); toggle(cert.id); }}
            style={({ pressed }) => ({
              flexDirection: "row", alignItems: "center", gap: 12, padding: 14,
              borderRadius: radius.lg, borderWidth: 2,
              borderColor: on ? c.accent : c.line2, backgroundColor: on ? c.accentSoft : c.paper,
              ...raised(on ? c.accentDeep : c.paperEdge, pressed),
              ...(!pressed ? shadow(c, 1) : null),
            })}
          >
            <Icon name="medal" size={36} />
            <View style={{ flex: 1, gap: 2 }}>
              <T size={16} weight="bold">{cert.name}</T>
              <T size={13} color="ink2">{cert.description}</T>
              <T size={12} color="muted">{cert.org} · 주제 {n}개</T>
              {on && <T size={12} color="muted">과목: {cert.subjects.map((s) => s.name).join(" · ")}</T>}
            </View>
            <View style={{
              width: 24, height: 24, borderRadius: 12, borderWidth: 1.5,
              borderColor: on ? c.accent : c.line2, backgroundColor: on ? c.accent : "transparent",
              alignItems: "center", justifyContent: "center",
            }}>
              {on && <Icon name="check" size={15} color="#ffffff" />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 고른 자격증 개수 */
export const certCount = (interests: string[]) => interests.filter(isCertId).length;
