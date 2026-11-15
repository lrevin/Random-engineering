/** 약점 분석: 기존 기록(records)에서 분야·주제별 정답률을 계산합니다. 서버 호출 없이 기기에 이미 있는 기록으로 집계합니다. */
import { domainById, topicById } from "@/data";
import type { StudyRecord } from "./types";

const countable = (r: StudyRecord) => r.countsAsStudy !== false && r.total > 0;

export interface DomainWeakness {
  domain: string;
  name: string;
  attempts: number;
  correct: number;
  total: number;
  /** 0~1 */
  accuracy: number;
}

export interface TopicWeakness {
  topicId: string;
  name: string;
  domain: string;
  domainName: string;
  attempts: number;
  correct: number;
  total: number;
  accuracy: number;
  lastAt: string;
}

/** 분야별 정답률, 낮은 순 (약한 분야가 먼저) */
export function domainWeakness(records: StudyRecord[]): DomainWeakness[] {
  const map = new Map<string, { correct: number; total: number; attempts: number }>();
  for (const r of records.filter(countable)) {
    const e = map.get(r.domain) ?? { correct: 0, total: 0, attempts: 0 };
    e.correct += r.score;
    e.total += r.total;
    e.attempts++;
    map.set(r.domain, e);
  }
  return [...map.entries()]
    .map(([domain, e]) => ({ domain, name: domainById(domain)?.name ?? domain, ...e, accuracy: e.total ? e.correct / e.total : 0 }))
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts);
}

/** 주제별 정답률, 낮은 순. minAttempts 미만으로 풀어본 주제는 데이터가 적어 제외 */
export function topicWeakness(records: StudyRecord[], minAttempts = 1): TopicWeakness[] {
  const map = new Map<string, { correct: number; total: number; attempts: number; domain: string; lastAt: string }>();
  for (const r of records.filter(countable)) {
    const e = map.get(r.topicId) ?? { correct: 0, total: 0, attempts: 0, domain: r.domain, lastAt: r.studiedAt };
    e.correct += r.score;
    e.total += r.total;
    e.attempts++;
    if (r.studiedAt > e.lastAt) e.lastAt = r.studiedAt;
    map.set(r.topicId, e);
  }
  return [...map.entries()]
    .filter(([, e]) => e.attempts >= minAttempts)
    .map(([topicId, e]) => ({
      topicId,
      name: topicById(topicId)?.ko ?? topicId,
      domain: e.domain,
      domainName: domainById(e.domain)?.name ?? e.domain,
      correct: e.correct,
      total: e.total,
      attempts: e.attempts,
      lastAt: e.lastAt,
      accuracy: e.total ? e.correct / e.total : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts);
}
