import { Pressable, View } from "react-native";
import { radius, useColors } from "@/theme";
import { Chip, Row, T, tap } from "./ui";

const PRESETS = ["07:30", "12:30", "18:00", "21:00", "22:30"];
const pad = (n: number) => String(n).padStart(2, "0");

function Step({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === "−" ? "줄이기" : "늘리기"}
      onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: c.line2, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1, backgroundColor: c.paper })}
    >
      <T size={22} weight="semibold">{label}</T>
    </Pressable>
  );
}

/** 알림 시각 고르기: 자주 쓰는 시각 + 시/분 조절 */
export function TimeStepper({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h, m] = value.split(":").map(Number);
  const set = (hh: number, mm: number) => onChange(`${pad((hh + 24) % 24)}:${pad((mm + 60) % 60)}`);

  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;

  return (
    <View style={{ gap: 14 }}>
      <Row style={{ justifyContent: "center" }} gap={14}>
        <View style={{ alignItems: "center", gap: 6 }}>
          <Step label="+" onPress={() => set(h + 1, m)} />
          <Step label="−" onPress={() => set(h - 1, m)} />
        </View>
        <View style={{ alignItems: "center", minWidth: 150 }}>
          <T size={14} color="muted">{ampm}</T>
          <T size={44} weight="bold" style={{ fontVariant: ["tabular-nums"], lineHeight: 54 }}>{h12}:{pad(m)}</T>
        </View>
        <View style={{ alignItems: "center", gap: 6 }}>
          <Step label="+" onPress={() => set(h + (m + 10 >= 60 ? 1 : 0), m + 10 - (m % 10))} />
          <Step label="−" onPress={() => set(h - (m < 10 ? 1 : 0), m % 10 ? m - (m % 10) : m - 10)} />
        </View>
      </Row>
      <Row style={{ justifyContent: "center" }}>
        {PRESETS.map((p) => (
          <Chip key={p} label={p} selected={p === value} onPress={() => onChange(p)} />
        ))}
      </Row>
    </View>
  );
}
