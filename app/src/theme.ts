import { useColorScheme, type ViewStyle } from "react-native";
import { useActiveThemeId } from "./lib/skins";
import { paletteFor, type Palette } from "./themes";

// 색은 src/themes.ts. 기본(클래식)은 로고(슬롯머신)와 같은 색: 크림 배경 + 남색 기계 + 빨강 레버 + 노랑 불빛
export type Colors = Palette;

/** 지금 테마의 색. 상점에서 고른 테마가 앱 전체에 적용되고, 클래식은 휴대폰 다크 모드를 따라감 */
export function useColors(): Colors {
  const scheme = useColorScheme();
  return paletteFor(useActiveThemeId(), scheme);
}

/** 화면 바탕: 테마에 그라데이션이 있으면 아주 옅게 깔고, 없으면 단색 */
export function screenBg(c: Colors): ViewStyle {
  return c.grad.bg ? { backgroundColor: c.bg, experimental_backgroundImage: c.grad.bg } : { backgroundColor: c.bg };
}

export const radius = { sm: 10, md: 14, lg: 22, pill: 999 };

/** 그림자: 1 = 버튼·작은 칸, 2 = 카드, 3 = 떠 있는 판 */
export function shadow(c: Colors, level: 1 | 2 | 3 = 1): ViewStyle {
  const [y, blur] = ({ 1: [2, 4], 2: [4, 12], 3: [10, 24] } as const)[level];
  return { boxShadow: `0px ${y}px ${blur}px ${c.shadow}` };
}

/** 움푹 들어간 홈 (분할 버튼 바탕, 입력칸) */
export const inset = (c: Colors) => ({ boxShadow: `inset 0px 2px 3px ${c.shadow}` });

/**
 * 눌리는 입체 면 (듀오링고식): 아래쪽에 두꺼운 테두리를 두고, 누르면 그만큼 내려감.
 * 전체 높이는 그대로라 주변 배치가 흔들리지 않음.
 */
export function raised(edge: string, pressed: boolean, depth = 4): ViewStyle {
  return { borderBottomWidth: pressed ? 1 : depth, borderBottomColor: edge, marginTop: pressed ? depth - 1 : 0 };
}
