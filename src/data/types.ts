export type Level = "기초" | "중급" | "심화";

/** [한국어 이름, 영어 위키피디아 문서 이름, 난이도(1=기초 2=중급 3=심화), 한 줄 힌트] */
export type RawTopic = [ko: string, en: string, level: 1 | 2 | 3, hint: string];

export interface CategoryDef {
  id: string;
  name: string;
  emoji: string;
}

export interface Domain {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** false면 "준비 중"으로 표시 (아직 주제 데이터가 없음) */
  available: boolean;
  categories: CategoryDef[];
}

export interface Topic {
  /** 예: "sec-07". 주제를 추가할 때는 목록 끝에 붙여야 id가 바뀌지 않습니다. */
  id: string;
  ko: string;
  en: string;
  domain: string;
  category: string;
  categoryName: string;
  level: Level;
  hint: string;
}
