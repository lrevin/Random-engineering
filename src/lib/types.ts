export interface StudyRecord {
  id: string;
  topicId: string;
  topicKo: string;
  domain: string;
  category: string;
  level: string;
  memo: string;
  rating: number;
  good: string;
  stuck: string;
  studySec: number;
  explainSec: number;
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
  explainMinutes: number;
  reminderEnabled: boolean;
  /** "HH:MM" */
  reminderTime: string;
}

export const DEFAULT_PREFS: Prefs = {
  nickname: "",
  interests: [],
  level: 0,
  studyMinutes: 15,
  explainMinutes: 2,
  reminderEnabled: true,
  reminderTime: "21:00",
};

export type Stage = "study" | "explain" | "finish";

/** 진행 중인 공부 (앱을 껐다 켜도 이어서 할 수 있도록 저장) */
export interface ActiveSession {
  topicId: string;
  stage: Stage;
  memo: string;
  studyTotal: number;
  studyLeft: number;
  studyUsed: number;
  explainTotal: number;
  explainLeft: number;
  explainUsed: number;
  rating: number;
  good: string;
  stuck: string;
  startedAt: string;
  /** 현재 단계 타이머가 돌고 있으면 끝나는 시각(ms), 멈춰 있으면 null */
  endAt: number | null;
}
