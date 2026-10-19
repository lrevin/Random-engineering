import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { fmtClock } from "@/lib/stats";
import { useColors } from "@/theme";
import { T } from "./ui";

/** 원형 카운트다운 타이머 */
export function Ring({ size, left, total, running, warnAt = 0 }: {
  size: number; left: number; total: number; running: boolean; warnAt?: number;
}) {
  const c = useColors();
  const stroke = Math.max(8, size * 0.05);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const frac = total ? Math.max(0, Math.min(1, left / total)) : 0;
  const warn = warnAt > 0 && left <= warnAt;
  const color = warn ? c.accent : c.navy;
  const state = running ? "진행 중" : left <= 0 ? "끝" : left < total - 0.5 ? "일시정지" : "대기";
  return (
    <View
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={`남은 시간 ${fmtClock(left)}, ${state}`}
    >
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.line} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={`${circ} ${circ}`} strokeDashoffset={circ * (1 - frac)}
        />
      </Svg>
      <T
        weight="semibold"
        size={Math.round(size * 0.24)}
        color={warn ? "accent" : running ? "ink" : "ink2"}
        style={{ fontVariant: ["tabular-nums"], lineHeight: Math.round(size * 0.3) }}
      >
        {fmtClock(left)}
      </T>
      <T size={13} color="muted">{state}</T>
    </View>
  );
}
