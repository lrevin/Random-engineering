import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * 이 휴대폰(AsyncStorage)에 저장하는 값 전체 목록.
 * 서버가 붙으면 server 표시가 있는 값부터 서버로 옮깁니다. (옮길 표 제안: api/APP_LOCAL_DATA.md)
 *
 * group
 *  - account  : 계정 · 설정 (이미 서버 profiles / study_records에 있음)
 *  - wallet   : 재화 · 구매 (톱니바퀴, 보호권, 배틀권, 프리미엄 …) → 서버 지갑으로 옮겨야 조작을 막을 수 있음
 *  - progress : 학습 진행 (모의고사 · 오답 · 복습 · 퀘스트 …) → 서버로 옮기면 기기를 바꿔도 이어짐
 *  - device   : 이 휴대폰에만 있으면 되는 값 (진행 중 화면, 안내 본 여부 …)
 */
export type LocalGroup = "account" | "wallet" | "progress" | "device";

export interface LocalKey {
  key: string;
  group: LocalGroup;
  /** 무엇이 들어 있는지 */
  desc: string;
  /** 서버로 옮길 대상인지 */
  server: boolean;
}

export const LOCAL_KEYS = {
  // ── 계정 · 설정
  mode: { key: "pg.mode", group: "account", desc: "둘러보기 / 로그인 상태", server: false },
  prefs: { key: "pg.prefs", group: "account", desc: "닉네임 · 관심 분야(자격증 포함) · 난이도 · 공부 시간 · 알림", server: true },
  onboarded: { key: "pg.onboarded", group: "account", desc: "처음 설정을 마쳤는지", server: false },
  uid: { key: "pg.uid", group: "account", desc: "친구 추가용 UID 8자리", server: true },
  records: { key: "pg.records", group: "account", desc: "공부 기록 (퀴즈 점수 · 경험치 · 오답)", server: true },
  // ── 재화 · 구매
  gears: { key: "pg.gears", group: "wallet", desc: "톱니바퀴 잔액", server: true },
  freezes: { key: "pg.freezes", group: "wallet", desc: "연속 기록 보호권 개수", server: true },
  premium: { key: "pg.premium", group: "wallet", desc: "프리미엄 여부 (지금은 시험용)", server: true },
  premiumBonus: { key: "pg.premiumBonus", group: "wallet", desc: "결제 보너스 톱니바퀴를 받은 달 목록", server: true },
  tickets: { key: "pg.battleTickets", group: "wallet", desc: "이번 달 무료 배틀권 · 산 배틀권", server: true },
  adViews: { key: "pg.adViews", group: "wallet", desc: "오늘 광고 본 횟수", server: true },
  boost: { key: "pg.boost", group: "wallet", desc: "경험치 2배 부스터가 끝나는 시각", server: true },
  skins: { key: "pg.skins", group: "wallet", desc: "가진 스킨 · 쓰는 스킨 · 칭호 · 받은 연속 기록 보상", server: true },
  // ── 학습 진행
  kept: { key: "pg.keptDays", group: "progress", desc: "보호권 · 복구로 지킨 날", server: true },
  battleXp: { key: "pg.battleXp", group: "progress", desc: "배틀 · 스피드 퀴즈로 얻은 경험치 합", server: true },
  battlesApplied: { key: "pg.battlesApplied", group: "progress", desc: "이미 반영한 배틀 · 보상 키 (중복 지급 방지)", server: true },
  questClaims: { key: "pg.questClaims", group: "progress", desc: "받은 퀘스트 보상 키", server: true },
  exam: { key: "pg.exam", group: "progress", desc: "모의고사 결과 · 오늘 본 횟수 · 1회권 · 모의고사 오답", server: true },
  reviewDone: { key: "pg.review.done2", group: "progress", desc: "오답 다시 풀기로 해결한 오답과 시각", server: true },
  recall: { key: "pg.recall", group: "progress", desc: "주제별 마지막 복습 시각", server: true },
  certDates: { key: "pg.certDates", group: "progress", desc: "자격증별 시험일", server: true },
  speed: { key: "pg.speed", group: "progress", desc: "스피드 퀴즈 최고 기록 · 오늘 받은 경험치", server: true },
  // ── 이 휴대폰에만
  active: { key: "pg.active", group: "device", desc: "진행 중인 공부 · 퀴즈 (앱을 껐다 켜도 이어서)", server: false },
  examActive: { key: "pg.exam.active", group: "device", desc: "풀고 있는 모의고사 (이어 풀기)", server: false },
  rescueAsked: { key: "pg.rescueAsked", group: "device", desc: "연속 기록 복구 창을 오늘 띄웠는지", server: false },
  battleIntroSeen: { key: "pg.battleIntroSeen", group: "device", desc: "배틀 설명을 봤는지", server: false },
  homeIntroSeen: { key: "pg.homeIntroSeen", group: "device", desc: "홈 사용법 안내를 봤는지", server: false },
} satisfies Record<string, LocalKey>;

export type LocalKeyName = keyof typeof LOCAL_KEYS;
export const ALL_LOCAL_KEYS = Object.values(LOCAL_KEYS).map((x) => x.key);

/**
 * 서버로 옮길 값을 한 번에 읽어 묶음으로 돌려줌 (둘러보기 → 회원가입할 때 서버에 올리는 용도).
 * 값은 저장된 그대로(JSON) 넣고, 읽지 못한 값은 빠집니다.
 */
export async function snapshotLocalData(): Promise<Partial<Record<LocalKeyName, unknown>>> {
  const names = (Object.keys(LOCAL_KEYS) as LocalKeyName[]).filter((n) => LOCAL_KEYS[n].server);
  const pairs = await AsyncStorage.multiGet(names.map((n) => LOCAL_KEYS[n].key)).catch(() => [] as [string, string | null][]);
  const out: Partial<Record<LocalKeyName, unknown>> = {};
  pairs.forEach(([, raw], i) => {
    if (raw == null) return;
    try {
      out[names[i]] = JSON.parse(raw);
    } catch {
      out[names[i]] = raw;
    }
  });
  return out;
}

/** 이 휴대폰의 뽑공 데이터 전부 지우기 (둘러보기 데이터 지우기 · 로그아웃) */
export const clearAllLocalData = () => AsyncStorage.multiRemove(ALL_LOCAL_KEYS).catch(() => {});
