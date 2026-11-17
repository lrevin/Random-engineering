import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * 오답 보스: 악마가 된 슬롯머신 (직접 그린 SVG).
 * 뿔 달린 간판 · 박쥐 날개 · 양쪽 릴 두 개가 눈 ·동전 받이가 송곳니 입 · 레버는 삼지창 · 꼬리.
 * mood: idle(비웃음) · hit(맞아서 찡그림 + 금 감) · laugh(입 벌리고 웃음) · down(쓰러짐)
 */
export type BossMood = "idle" | "hit" | "laugh" | "down";

export function BossArt({ size = 180, mood = "idle" }: { size?: number; mood?: BossMood }) {
  const down = mood === "down", hit = mood === "hit", laugh = mood === "laugh";
  const body = down ? ["#6b5f66", "#3d3439", "#231d21"] : ["#e2364a", "#9c1028", "#4a0614"];
  const ink = "#1b0509";
  return (
    <Svg width={size} height={size * (220 / 240)} viewBox="0 0 240 220">
      <Defs>
        <RadialGradient id="bs-aura" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#ff3b2f" stopOpacity={down ? 0 : laugh ? 0.55 : 0.38} />
          <Stop offset="1" stopColor="#ff3b2f" stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id="bs-body" x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor={body[0]} />
          <Stop offset="0.55" stopColor={body[1]} />
          <Stop offset="1" stopColor={body[2]} />
        </LinearGradient>
        <LinearGradient id="bs-horn" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={down ? "#8d8288" : "#f3e3c8"} />
          <Stop offset="0.6" stopColor={down ? "#5a4f55" : "#c9873c"} />
          <Stop offset="1" stopColor={down ? "#3b3337" : "#5c1a0c"} />
        </LinearGradient>
        <LinearGradient id="bs-wing" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={down ? "#4a4248" : "#3a0d2a"} />
          <Stop offset="1" stopColor={down ? "#2b2529" : "#16040f"} />
        </LinearGradient>
        <LinearGradient id="bs-window" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={down ? "#3a3236" : "#2a0508"} />
          <Stop offset="0.5" stopColor={down ? "#4b4146" : "#5a0d12"} />
          <Stop offset="1" stopColor={down ? "#3a3236" : "#2a0508"} />
        </LinearGradient>
        <RadialGradient id="bs-eye" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#fff6b0" />
          <Stop offset="0.55" stopColor="#ffc21a" />
          <Stop offset="1" stopColor="#ff5a00" />
        </RadialGradient>
        <RadialGradient id="bs-flame" cx="0.5" cy="0.65" r="0.6">
          <Stop offset="0" stopColor="#fff1a8" />
          <Stop offset="0.45" stopColor="#ff9a1f" />
          <Stop offset="1" stopColor="#d6140f" />
        </RadialGradient>
        <LinearGradient id="bs-metal" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#5a5458" />
          <Stop offset="0.5" stopColor="#c9c2c6" />
          <Stop offset="1" stopColor="#4a4448" />
        </LinearGradient>
      </Defs>

      <Circle cx={120} cy={112} r={112} fill="url(#bs-aura)" />
      <Ellipse cx={120} cy={208} rx={70} ry={8} fill="#000" opacity={0.28} />

      {/* 박쥐 날개 */}
      {[1, -1].map((s) => (
        <G key={s} transform={s === -1 ? "translate(240 0) scale(-1 1)" : undefined}>
          <Path d="M58 92 Q30 60 6 70 Q18 84 14 98 Q26 96 30 110 Q40 104 48 116 Q52 106 60 112 Z"
            fill="url(#bs-wing)" stroke={ink} strokeWidth={3} strokeLinejoin="round" />
          <Path d="M56 94 Q34 78 12 72 M56 98 L22 98 M56 104 L36 108" stroke={down ? "#6b6066" : "#8c1d3c"} strokeWidth={1.8} fill="none" strokeLinecap="round" />
        </G>
      ))}

      {/* 꼬리 */}
      <Path d="M66 184 Q40 196 30 176 Q22 160 36 150" stroke={down ? "#3d3439" : "#7a0b1f"} strokeWidth={6} fill="none" strokeLinecap="round" />
      <Path d="M36 150 L26 142 L44 140 Z" fill={down ? "#3d3439" : "#7a0b1f"} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />

      {/* 뿔 */}
      <Path d="M78 46 Q62 22 70 4 Q82 22 98 34 Z" fill="url(#bs-horn)" stroke={ink} strokeWidth={3} strokeLinejoin="round" />
      <Path d="M162 46 Q178 22 170 4 Q158 22 142 34 Z" fill="url(#bs-horn)" stroke={ink} strokeWidth={3} strokeLinejoin="round" />

      {/* 레버 = 삼지창 */}
      <G opacity={down ? 0.7 : 1}>
        <Rect x={186} y={108} width={14} height={20} rx={4} fill="url(#bs-metal)" stroke={ink} strokeWidth={2.5} />
        <Path d="M200 118 L216 118 L216 46" stroke={ink} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M200 118 L216 118 L216 46" stroke="url(#bs-metal)" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M204 50 Q204 34 210 28 L210 42 L216 22 L222 42 L222 28 Q228 34 228 50 Q222 56 216 56 Q210 56 204 50 Z"
          fill={down ? "#6b5f66" : "#c41b2c"} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />
      </G>

      {/* 몸통 */}
      <Path d="M54 66 Q54 40 120 36 Q186 40 186 66 L186 186 Q186 196 176 196 L64 196 Q54 196 54 186 Z"
        fill="url(#bs-body)" stroke={ink} strokeWidth={4} strokeLinejoin="round" />
      <Path d="M64 70 Q66 50 104 45" stroke="#fff" strokeWidth={5} fill="none" strokeLinecap="round" opacity={down ? 0.12 : 0.3} />

      {/* 간판 불빛 3개 → 불꽃 */}
      {[92, 120, 148].map((x, i) => (
        <G key={x} opacity={down ? 0.25 : 1}>
          <Circle cx={x} cy={56} r={7} fill={ink} />
          <Path d={`M${x} ${44 - (i === 1 ? 3 : 0)} Q${x + 7} ${52} ${x + 5} ${58} Q${x} ${63} ${x - 5} ${58} Q${x - 7} ${52} ${x} ${44 - (i === 1 ? 3 : 0)} Z`} fill="url(#bs-flame)" />
        </G>
      ))}

      {/* 화난 눈썹 (창 위) */}
      {!down && (laugh ? (
        <G stroke={ink} strokeWidth={6} strokeLinecap="round">
          <Path d="M70 76 Q84 66 98 74" fill="none" />
          <Path d="M142 74 Q156 66 170 76" fill="none" />
        </G>
      ) : (
        <G stroke={ink} strokeWidth={6} strokeLinecap="round">
          <Path d={hit ? "M70 70 L98 80" : "M68 70 L100 82"} />
          <Path d={hit ? "M170 70 L142 80" : "M172 70 L140 82"} />
        </G>
      ))}

      {/* 릴 창 */}
      <Rect x={64} y={84} width={112} height={48} rx={8} fill="url(#bs-window)" stroke={ink} strokeWidth={3.5} />
      <Path d="M101 86 L101 130 M139 86 L139 130" stroke={ink} strokeWidth={3} />
      {/* 양쪽 릴: 눈 */}
      {[82, 158].map((x) => (
        <G key={x}>
          {down ? (
            <Path d={`M${x - 9} ${99} L${x + 9} ${117} M${x + 9} ${99} L${x - 9} ${117}`} stroke="#c9c2c6" strokeWidth={5} strokeLinecap="round" />
          ) : laugh ? (
            <Path d={`M${x - 11} ${113} Q${x} ${96} ${x + 11} ${113}`} stroke="url(#bs-eye)" strokeWidth={6} fill="none" strokeLinecap="round" />
          ) : hit ? (
            <Path d={x < 120 ? `M${x - 10} ${99} L${x + 8} ${108} L${x - 10} ${117}` : `M${x + 10} ${99} L${x - 8} ${108} L${x + 10} ${117}`}
              stroke="#ffd34d" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <G>
              <Ellipse cx={x} cy={110} rx={13} ry={11} fill="url(#bs-eye)" />
              <Ellipse cx={x + (x < 120 ? 3 : -3)} cy={111} rx={2.6} ry={8.5} fill={ink} />
              <Circle cx={x - 4} cy={105} r={2.4} fill="#fff" opacity={0.9} />
            </G>
          )}
        </G>
      ))}

      {/* 입 = 동전 받이 */}
      {down ? (
        <Path d="M92 164 Q120 156 148 164" stroke={ink} strokeWidth={5} fill="none" strokeLinecap="round" />
      ) : laugh ? (
        <G>
          <Path d="M78 146 Q120 142 162 146 Q156 190 120 190 Q84 190 78 146 Z" fill="#2a0306" stroke={ink} strokeWidth={4} strokeLinejoin="round" />
          <Path d="M100 178 Q120 166 140 178 Q132 188 120 188 Q108 188 100 178 Z" fill="#e0455a" />
          <Path d="M84 148 L92 160 L100 148 M140 148 L148 160 L156 148" fill="#fff" stroke="#fff" strokeWidth={1.5} strokeLinejoin="round" />
          <Path d="M112 147 L116 154 L120 147 L124 154 L128 147" fill="#fff" stroke="#fff" strokeWidth={1.2} strokeLinejoin="round" />
        </G>
      ) : hit ? (
        <G>
          <Path d="M84 160 Q94 152 104 162 Q114 170 124 160 Q134 152 144 162 Q150 168 156 160" stroke={ink} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M98 160 L100 168 M138 160 L140 168" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
        </G>
      ) : (
        <G>
          <Path d="M80 152 Q120 182 160 150 Q148 166 120 168 Q94 168 80 152 Z" fill="#2a0306" stroke={ink} strokeWidth={4} strokeLinejoin="round" />
          <Path d="M92 158 L97 170 L102 161 M138 161 L143 170 L148 157" fill="#fff" stroke="#fff" strokeWidth={1.5} strokeLinejoin="round" />
        </G>
      )}

      {/* 맞았을 때 금 */}
      {(hit || down) && (
        <G stroke={down ? "#1b1517" : "#2a0306"} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M176 140 L166 150 L172 158 L160 170" />
          <Path d="M62 136 L72 146 L66 154" />
        </G>
      )}
      {/* 쓰러졌을 때 연기 */}
      {down && (
        <G fill="#8d8a8c" opacity={0.55}>
          <Circle cx={92} cy={28} r={9} />
          <Circle cx={104} cy={18} r={7} />
          <Circle cx={140} cy={24} r={8} />
          <Circle cx={150} cy={12} r={6} />
        </G>
      )}
    </Svg>
  );
}
