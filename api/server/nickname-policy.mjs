// 닉네임 금칙어: 랭킹처럼 다른 사용자에게 보이는 곳에 나가므로 욕설 · 성적 표현 · 운영자 사칭을 막음.
// 띄어쓰기 · 기호 · 숫자를 빼고 비교해서 "시 1 발" 같은 우회도 잡음.
const BANNED = [
  '시발', '씨발', '씨빨', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '개새', '좆', '존나', '지랄', '미친놈', '미친년', '썅', '니애미', '느금', '엠창',
  '섹스', '야동', 'fuck', 'shit', 'bitch', 'sex', 'porn',
  '운영자', '관리자', 'admin', '뽑공공식',
];

const squash = (s) => s.toLowerCase().replace(/[\s\p{P}\p{S}\d_]/gu, '');

export function nicknameAllowed(nickname) {
  const n = squash(nickname);
  return !BANNED.some((w) => n.includes(w));
}
