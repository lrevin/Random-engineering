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
  studyMinutes: number;
  explainMinutes: number;
  reminderEnabled: boolean;
  /** "HH:MM" */
  reminderTime: string;
}

export const DEFAULT_PREFS: Prefs = {
  nickname: "",
  interests: [],
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
