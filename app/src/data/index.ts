import { AERO_CATEGORIES, AERO_RAW } from "./aero";
import { ARCH_CATEGORIES, ARCH_RAW } from "./arch";
import { BIO_CATEGORIES, BIO_RAW } from "./bio";
import { CHE_CATEGORIES, CHE_RAW } from "./che";
import { CHEM_CATEGORIES, CHEM_RAW } from "./chem";
import { CIVIL_CATEGORIES, CIVIL_RAW } from "./civil";
import { EARTH_CATEGORIES, EARTH_RAW } from "./earth";
import { EE_CATEGORIES, EE_RAW } from "./ee";
import { ENV_CATEGORIES, ENV_RAW } from "./env";
import { IE_CATEGORIES, IE_RAW } from "./ie";
import { IT_CATEGORIES, IT_RAW } from "./it";
import { KO_WIKI } from "./kowiki";
import { LIFE_CATEGORIES, LIFE_RAW } from "./life";
import { OFFICIAL_DOCS } from "./links";
import { MAT_CATEGORIES, MAT_RAW } from "./mat";
import { MATH_CATEGORIES, MATH_RAW } from "./math";
import { ME_CATEGORIES, ME_RAW } from "./me";
import { PHYS_CATEGORIES, PHYS_RAW } from "./phys";
import type { CategoryDef, Domain, Level, LevelNum, RawTopic, Topic } from "./types";

export * from "./types";
export { RELATED, relatedFor } from "./related";

export const LEVEL_NAMES: Record<LevelNum, Level> = { 1: "기초", 2: "중급", 3: "심화" };
const LEVEL_BY_NAME: Record<string, LevelNum> = { 기초: 1, 중급: 2, 심화: 3 };

/** "Lv.2 중급" 형태의 표시용 이름. 숫자나 "중급" 같은 이름 모두 받습니다. */
export const levelText = (l: string | number) => {
  const n = (typeof l === "number" ? l : LEVEL_BY_NAME[l]) as LevelNum | undefined;
  return n && LEVEL_NAMES[n] ? `Lv.${n} ${LEVEL_NAMES[n]}` : String(l);
};

/** 공학·과학 분야 묶음. 분야를 추가하려면 데이터 파일을 만들고 여기와 RAW_BY_DOMAIN에 등록하면 됩니다. */
export const DOMAINS: Domain[] = [
  { id: "it", name: "컴퓨터공학", emoji: "💻", description: "자료구조, 운영체제, 네트워크, 정보보안", available: true, group: "eng", categories: IT_CATEGORIES },
  { id: "ee", name: "전기·전자공학", emoji: "⚡", description: "회로, 반도체, 통신, 전력, 제어", available: true, group: "eng", categories: EE_CATEGORIES },
  { id: "me", name: "기계공학", emoji: "⚙️", description: "4대 역학, 기계설계, 생산가공", available: true, group: "eng", categories: ME_CATEGORIES },
  { id: "che", name: "화학공학", emoji: "⚗️", description: "화공열역학, 반응공학, 분리공정", available: true, group: "eng", categories: CHE_CATEGORIES },
  { id: "civil", name: "토목공학", emoji: "🌉", description: "구조, 지반, 수리, 교통, 콘크리트", available: true, group: "eng", categories: CIVIL_CATEGORIES },
  { id: "arch", name: "건축공학", emoji: "🏗️", description: "건축구조, 환경설비, 시공, 계획", available: true, group: "eng", categories: ARCH_CATEGORIES },
  { id: "mat", name: "신소재공학", emoji: "🧪", description: "결정구조, 상태도, 재료 물성", available: true, group: "eng", categories: MAT_CATEGORIES },
  { id: "ie", name: "산업공학", emoji: "📊", description: "최적화, 품질, 생산·물류, 인간공학", available: true, group: "eng", categories: IE_CATEGORIES },
  { id: "env", name: "환경·에너지공학", emoji: "🌱", description: "수처리, 대기, 폐기물, 신재생에너지", available: true, group: "eng", categories: ENV_CATEGORIES },
  { id: "aero", name: "항공우주공학", emoji: "✈️", description: "공기역학, 추진, 비행역학, 궤도", available: true, group: "eng", categories: AERO_CATEGORIES },
  { id: "bio", name: "바이오·의공학", emoji: "🧬", description: "생명공학, 유전공학, 의료기기", available: true, group: "eng", categories: BIO_CATEGORIES },
  // 과학: 공학의 바탕이 되는 기초 이론
  { id: "math", name: "수학", emoji: "📐", description: "선형대수, 미적분, 확률·통계, 공업수학", available: true, group: "sci", categories: MATH_CATEGORIES },
  { id: "phys", name: "물리학", emoji: "🍎", description: "역학, 전자기학, 열물리, 파동, 현대물리", available: true, group: "sci", categories: PHYS_CATEGORIES },
  { id: "chem", name: "화학", emoji: "🧪", description: "일반·유기·물리·분석화학", available: true, group: "sci", categories: CHEM_CATEGORIES },
  { id: "life", name: "생명과학", emoji: "🦠", description: "세포, 유전, 생리, 생태·진화", available: true, group: "sci", categories: LIFE_CATEGORIES },
  { id: "earth", name: "지구과학", emoji: "🌏", description: "지질, 대기·해양, 천문학", available: true, group: "sci", categories: EARTH_CATEGORIES },
];

export const DOMAIN_GROUPS = [
  { id: "eng", name: "공학" },
  { id: "sci", name: "과학" },
] as const;

const RAW_BY_DOMAIN: Record<string, Record<string, RawTopic[]>> = {
  it: IT_RAW, ee: EE_RAW, me: ME_RAW, che: CHE_RAW, civil: CIVIL_RAW, arch: ARCH_RAW,
  mat: MAT_RAW, ie: IE_RAW, env: ENV_RAW, aero: AERO_RAW, bio: BIO_RAW,
  math: MATH_RAW, phys: PHYS_RAW, chem: CHEM_RAW, life: LIFE_RAW, earth: EARTH_RAW,
};

export const TOPICS: Topic[] = DOMAINS.flatMap((d) =>
  d.categories.flatMap((c) =>
    (RAW_BY_DOMAIN[d.id]?.[c.id] ?? []).map(([ko, en, lv, hint], i) => ({
      id: `${c.id}-${String(i + 1).padStart(2, "0")}`,
      ko,
      en,
      domain: d.id,
      category: c.id,
      categoryName: c.name,
      lv,
      level: LEVEL_NAMES[lv],
      hint,
    })),
  ),
);

export const ALL_CATEGORIES: (CategoryDef & { domain: string })[] = DOMAINS.flatMap((d) =>
  d.categories.map((c) => ({ ...c, domain: d.id })),
);

const topicMap = new Map(TOPICS.map((t) => [t.id, t]));
export const topicById = (id: string) => topicMap.get(id);
export const categoryById = (id: string) => ALL_CATEGORIES.find((c) => c.id === id);
export const domainById = (id: string) => DOMAINS.find((d) => d.id === id);
export const topicCount = (pred: (t: Topic) => boolean) => TOPICS.filter(pred).length;

/** 위키 검색어: 괄호 안 설명은 빼고 검색 */
export const searchTerm = (ko: string) => ko.replace(/\s*\(.*?\)\s*/g, " ").trim();

const wikiUrl = (lang: "ko" | "en", title: string) =>
  `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

export interface TopicLinks {
  /** 한국어 위키백과 문서 (언어 간 링크로 확인된 실제 문서). 없으면 undefined */
  koWiki?: { title: string; url: string };
  /** 영어 위키피디아 문서 */
  enWiki: { title: string; url: string };
  /** 공식 문서 (표준·공식 사이트). 없으면 undefined */
  official?: { label: string; url: string };
  /** 나무위키 검색 */
  namu: string;
}

export const topicLinks = (t: Topic): TopicLinks => {
  const ko = KO_WIKI[t.en];
  return {
    koWiki: ko ? { title: ko, url: wikiUrl("ko", ko) } : undefined,
    enWiki: { title: t.en, url: wikiUrl("en", t.en) },
    official: OFFICIAL_DOCS[t.en],
    namu: `https://namu.wiki/Search?q=${encodeURIComponent(searchTerm(t.ko))}`,
  };
};
