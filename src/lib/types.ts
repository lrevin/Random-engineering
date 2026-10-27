import type { QuizQuestion } from "./quiz";
import type { RpPart } from "./rank";

/** 틀린 문제 (기록 화면에서 다시 보기용) */
export interface WrongAnswer {
  q: string;
  answer: string;
  explain: string;
}

export interface StudyRecord {
  id: string;
  topicId: string;
  topicKo: string;
  domain: string;
  category: string;
  level: string;
  memo: string;
  /** 퀴즈 정답 수 */
  score: number;
  /** 퀴즈 문제 수 (보통 10) */
  total: number;
  /** 이번에 얻은 랭크 포인트 */
  rp: number;
  wrong: WrongAnswer[];
  /** 공부 시간(초). 퀴즈만 다시 푼 경우 0 */
  studySec: number;
  /** ai: AI가 만든 퀴즈 · offline: 오프라인 연습 퀴즈 */
  quizSource: "ai" | "offline";
  studiedAt: string;
  /** 서버에 올라갔는지 (게스트 기록이나 오프라인 저장분은 false) */
  synced: boolean;
}

export interface Prefs {
  nickname: string;
  interests: string[];
  /** 주로 공부할 난이도: 0=골고루, 1=Lv.1 기초, 2=Lv.2 중급, 3=Lv.3 심화 */
  level: 0 | 1 | 2 | 3;
  studyMinutes: number;
  reminderEnabled: boolean;
  /** "HH:MM" */
  reminderTime: string;
}

export const DEFAULT_PREFS: Prefs = {
  nickname: "",
  interests: [],
  level: 0,
  studyMinutes: 15,
  reminderEnabled: true,
  reminderTime: "21:00",
};

/** 공부 → 퀴즈 → 결과 */
export type Stage = "study" | "quiz" | "result";

export interface QuizProgress {
  source: "ai" | "offline";
  questions: QuizQuestion[];
  /** 고른 답 (4지선다는 보기 번호, OX는 true/false). 아직 안 푼 문제는 배열에 없음 */
  answers: (number | boolean)[];
}

export interface QuizResult {
  score: number;
  total: number;
  rp: number;
  parts: RpPart[];
  userTierBefore: number;
  userTierAfter: number;
  topicTierBefore: number;
  topicTierAfter: number;
  streak: number;
}

/** 진행 중인 공부 (앱을 껐다 켜도 이어서 할 수 있도록 저장) */
export interface ActiveSession {
  topicId: string;
  stage: Stage;
  memo: string;
  studyTotal: number;
  studyLeft: number;
  studyUsed: number;
  /** 공부 없이 퀴즈만 다시 푸는 경우 */
  quizOnly: boolean;
  quiz: QuizProgress | null;
  result: QuizResult | null;
  startedAt: string;
  /** 공부 타이머가 돌고 있으면 끝나는 시각(ms), 멈춰 있으면 null */
  endAt: number | null;
}
