import { useWindowDimensions } from "react-native";

/**
 * 기기마다 다른 화면 폭 · 시스템 글자 크기에 맞춰 글자와 여백을 조절.
 * - 디자인 기준 폭 392dp (Pixel 6 · 갤럭시 S 기본). 좁은 폰(360dp)은 조금 작게, 넓은 폰은 조금 크게
 * - 휴대폰 설정의 '글자 크기'는 1.2배까지만 따르고, 화면 폭 보정과 합쳐 디자인보다 1.12배를 넘지 않게
 *   (그 이상 커지면 칸 밖으로 잘리거나 줄이 넘침)
 */
export const BASE_WIDTH = 392;
export const MAX_FONT_SCALE = 1.2;
const MAX_TEXT_ZOOM = 1.12;

export function scaleFor(width: number, fontScale: number) {
  const s = Math.min(1.08, Math.max(0.86, width / BASE_WIDTH));
  const sys = Math.min(Math.max(fontScale, 1), MAX_FONT_SCALE);
  // 글자: 화면 폭 보정 × (RN이 곱하는) 시스템 글자 크기 ≤ MAX_TEXT_ZOOM
  const text = Math.max(0.72, Math.min(s, MAX_TEXT_ZOOM / sys));
  return { s, text, narrow: width < 370 };
}

/** 지금 화면의 보정 값: s(여백 · 그림), text(글자), narrow(좁은 폰) */
export function useScale() {
  const { width, fontScale } = useWindowDimensions();
  return scaleFor(width, fontScale);
}

/** 큰 숫자를 짧게: 9,999 까지는 그대로, 그 위는 "99.8만" · "1,234만" */
export function compactNumber(n: number) {
  if (n < 10000) return n.toLocaleString();
  const man = n / 10000;
  return `${man < 100 ? (Math.floor(man * 10) / 10).toString() : Math.floor(man).toLocaleString()}만`;
}
