import { Pressable, View } from "react-native";
import { CERTS, CERT_GROUPS, isCertId } from "@/data";
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
  // 분야별로 묶음 (묶음에 없는 자격증은 "기타")
  const grouped = new Set(CERT_GROUPS.flatMap((g) => g.ids));
  const groups = [
    ...CERT_GROUPS.map((g) => ({ name: g.name, certs: g.ids.map((id) => CERTS.find((x) => x.id === id)).filter((x) => !!x) })),
    { name: "기타", certs: CERTS.filter((x) => !grouped.has(x.id)) },
  ].filter((g) => g.certs.length);
  return (
    <View style={{ gap: 18 }}>
      {groups.map((g) => (
        <View key={g.name} style={{ gap: 10 }}>
        <T size={15} weight="bold" color="ink2">{g.name}</T>
          {g.certs.map((cert) => {
            const on = value.includes(cert.id);
            return (
              <Pressable
                key={cert.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={cert.name}
                onPress={() => { tap(); toggle(cert.id); }}
                style={({ pressed }) => ({
                  flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14,
                  borderRadius: radius.lg, borderWidth: 2,
                  borderColor: on ? c.accent : c.line2, backgroundColor: on ? c.accentSoft : c.paper,
                  ...raised(on ? c.accentDeep : c.paperEdge, pressed),
                  ...(!pressed ? shadow(c, 1) : null),
                })}
              >
                <Icon name="medal" size={28} />
                {/* 자격증 이름만 (설명 · 기관 · 과목은 보여 주지 않음) */}
                <T size={16} weight="bold" style={{ flex: 1 }}>{cert.name}</T>
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
      ))}
    </View>
  );
}

/** 고른 자격증 개수 */
export const certCount = (interests: string[]) => interests.filter(isCertId).length;
