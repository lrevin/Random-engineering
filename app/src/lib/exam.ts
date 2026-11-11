import AsyncStorage from "@react-native-async-storage/async-storage";
import { certById, topicById, TOPICS, type CertDef, type Topic } from "@/data";
import { FREE_EXAMS_PER_DAY } from "./economy";
import { examQuestions, type ExamItem } from "./quiz";
import { dateKey } from "./stats";

/** 한 과목에서 내는 문제 수 (실제 시험 20문제의 절반) */
export const EXAM_PER_SUBJECT = 10;
/** 합격 기준: 과목마다 40% 이상(과락) · 전체 평균 60% 이상 */
export const EXAM_SUBJECT_MIN = 0.4;
export const EXAM_TOTAL_MIN = 0.6;

export interface ExamPaperItem extends ExamItem { subject: number }
export interface ExamPaper { certId: string; subjects: string[]; items: ExamPaperItem[] }

export interface ExamSubjectScore { name: string; score: number; total: number }
export interface ExamResult {
  certId: string;
  at: string;
  subjects: ExamSubjectScore[];
  score: number;
  total: number;
  pass: boolean;
}

/** 과목에 적힌 주제 id / 세부 분야 id를 실제 주제로 */
const subjectTopics = (items: string[]): Topic[] => [
  ...new Map(items.flatMap((it) => {
    const t = topicById(it);
    return t ? [t] : TOPICS.filter((x) => x.category === it);
  }).map((t) => [t.id, t])).values(),
];

/** 모의고사 한 회분 만들기: 과목 순서대로, 과목마다 EXAM_PER_SUBJECT문제 */
export async function buildExam(cert: CertDef): Promise<ExamPaper> {
  const parts = await Promise.all(cert.subjects.map((s) => examQuestions(subjectTopics(s.items), EXAM_PER_SUBJECT)));
  return {
    certId: cert.id,
    subjects: cert.subjects.map((s) => s.name),
    items: parts.flatMap((qs, subject) => qs.map((x) => ({ ...x, subject }))),
  };
}

/** 채점: 과목별 점수와 합격 여부 */
export function gradeExam(paper: ExamPaper, answers: (number | boolean)[]): ExamResult {
  const subjects = paper.subjects.map((name, i) => {
    const idx = paper.items.map((x, k) => (x.subject === i ? k : -1)).filter((k) => k >= 0);
    return { name, total: idx.length, score: idx.filter((k) => answers[k] === paper.items[k].q.answer).length };
  });
  const score = subjects.reduce((a, s) => a + s.score, 0);
  const total = subjects.reduce((a, s) => a + s.total, 0);
  const pass = total > 0 && score / total >= EXAM_TOTAL_MIN && subjects.every((s) => !s.total || s.score / s.total >= EXAM_SUBJECT_MIN);
  return { certId: paper.certId, at: new Date().toISOString(), subjects, score, total, pass };
}

export const subjectFailed = (s: ExamSubjectScore) => s.total > 0 && s.score / s.total < EXAM_SUBJECT_MIN;

// ───────── 저장: 오늘 본 횟수 + 지난 결과 ─────────
const KEY = "pg.exam";
/** 모의고사에서 틀린 문제 (오답 다시 풀기에서 씀) */
export interface ExamWrong { topicId: string; q: string; answer: string; explain: string; at: string }
interface ExamStore { day: string; n: number; results: ExamResult[]; wrongs: ExamWrong[] }
const EMPTY: ExamStore = { day: "", n: 0, results: [], wrongs: [] };

export async function readExamStore(): Promise<ExamStore> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as Partial<ExamStore>) : null;
    return { day: s?.day ?? "", n: s?.n ?? 0, results: Array.isArray(s?.results) ? s.results.filter((r) => certById(r.certId)) : [], wrongs: Array.isArray(s?.wrongs) ? s.wrongs : [] };
  } catch {
    return EMPTY;
  }
}
const save = (s: ExamStore) => AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});

/** 오늘 본 횟수 */
export const examsToday = (s: ExamStore, now = new Date()) => (s.day === dateKey(now) ? s.n : 0);
/** 무료 사용자가 오늘 더 볼 수 있는 횟수 */
export const freeExamsLeft = (s: ExamStore) => Math.max(0, FREE_EXAMS_PER_DAY - examsToday(s));

/** 시험을 시작할 때 오늘 횟수를 1 올림 */
export async function countExamStart(): Promise<ExamStore> {
  const s = await readExamStore();
  const next = { ...s, day: dateKey(new Date()), n: examsToday(s) + 1 };
  await save(next);
  return next;
}

/** 결과 저장 (최근 30회) + 틀린 문제 모아 두기 (최근 300개) */
export async function saveExamResult(r: ExamResult, wrongs: ExamWrong[] = []): Promise<ExamStore> {
  const s = await readExamStore();
  const next = { ...s, results: [r, ...s.results].slice(0, 30), wrongs: [...wrongs, ...s.wrongs].slice(0, 300) };
  await save(next);
  return next;
}
