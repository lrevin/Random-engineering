import { IT_CATEGORIES, IT_RAW } from "./it";
import type { CategoryDef, Domain, Level, Topic } from "./types";

export * from "./types";

const LEVELS: Record<1 | 2 | 3, Level> = { 1: "기초", 2: "중급", 3: "심화" };

/** 분야 묶음. 새 분야는 available: true로 바꾸고 주제 데이터를 연결하면 됩니다. */
export const DOMAINS: Domain[] = [
  { id: "it", name: "IT·컴퓨터", emoji: "💻", description: "전공 과목, 정보보안기사, 개발 면접 범위", available: true, categories: IT_CATEGORIES },
  { id: "science", name: "자연과학", emoji: "🔬", description: "물리, 화학, 생명과학, 지구과학", available: false, categories: [] },
  { id: "history", name: "역사", emoji: "🏛️", description: "한국사, 세계사", available: false, categories: [] },
  { id: "economy", name: "경제·경영", emoji: "📈", description: "경제학 개념, 금융, 마케팅", available: false, categories: [] },
  { id: "humanities", name: "인문·철학", emoji: "📚", description: "철학, 심리학, 언어", available: false, categories: [] },
];

const RAW_BY_DOMAIN: Record<string, Record<string, [string, string, 1 | 2 | 3, string][]>> = {
  it: IT_RAW,
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
      level: LEVELS[lv],
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

/** 위키 검색어: 괄호 안 설명은 빼고 검색 */
export const searchTerm = (ko: string) => ko.replace(/\s*\(.*?\)\s*/g, " ").trim();

export const studyLinks = (t: Topic) => {
  const q = encodeURIComponent(searchTerm(t.ko));
  return [
    { label: "한국어 위키백과", url: `https://ko.wikipedia.org/w/index.php?search=${q}` },
    { label: "영어 위키피디아", url: `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(t.en)}` },
    { label: "나무위키", url: `https://namu.wiki/Search?q=${q}` },
  ];
};
