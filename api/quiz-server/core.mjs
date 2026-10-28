// 퀴즈 AI 핵심: 출제 지침(gem.md), 출력 형식, 검증, 비슷한 문제 거르기, Claude 호출
// server.mjs 와 test.mjs 가 함께 씁니다.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "..", "..");
export const MODEL = process.env.QUIZ_MODEL || "claude-opus-5-5";

/** 출제 지침. 이 파일을 고치면 서버를 다시 켤 필요 없이 다음 출제부터 반영됩니다 (Gemini Gems의 '안내'와 같은 역할). */
export const readGem = () => fs.readFileSync(path.join(HERE, "gem.md"), "utf8");

// ───────── 데이터: 주제 목록 + 우리가 미리 만든 문제 ─────────
const TOPICS_FILE = path.join(ROOT, "api", "supabase", "functions", "generate-quiz", "topics.json");
const BANK_DIR = path.join(ROOT, "app", "src", "data", "quizbank");

export const loadTopics = () => JSON.parse(fs.readFileSync(TOPICS_FILE, "utf8"));

/** 앱에 내장된 문제 은행 (topicId → 문제 배열) */
export function loadBank() {
  const bank = {};
  for (const f of fs.readdirSync(BANK_DIR).filter((x) => x.endsWith(".json"))) {
    Object.assign(bank, JSON.parse(fs.readFileSync(path.join(BANK_DIR, f), "utf8")));
  }
  return bank;
}

// ───────── 비슷한 문제 거르기 (앱 src/lib/quiz.ts 와 같은 방법) ─────────
const normalize = (s) => String(s).toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
const bigrams = (s) => {
  const n = normalize(s);
  const out = new Set();
  for (let i = 0; i < n.length - 1; i++) out.add(n.slice(i, i + 2));
  return out;
};
export function similarity(a, b) {
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return normalize(a) === normalize(b) ? 1 : 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}
export const SIMILAR = 0.5;
/** against(문장 배열)와 비슷하지 않고 서로도 겹치지 않는 문제만 남김 */
export function distinct(questions, against = []) {
  const kept = [];
  for (const q of questions) {
    const others = [...against, ...kept.map((k) => k.q)];
    if (!others.some((o) => similarity(q.q, o) >= SIMILAR)) kept.push(q);
  }
  return kept;
}

// ───────── 출력 형식 + 검증 ─────────
export const SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["mc", "ox"] },
          q: { type: "string" },
          choices: { type: "array", items: { type: "string" } },
          answer_index: { type: "integer" },
          answer_bool: { type: "boolean" },
          explain: { type: "string" },
        },
        required: ["type", "q", "choices", "answer_index", "answer_bool", "explain"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

/** 모델 출력 → 앱 형식. 형식이 맞지 않는 문제는 버림 */
export function toQuestions(raw) {
  const out = [];
  for (const r of raw ?? []) {
    const q = String(r.q ?? "").trim();
    const explain = String(r.explain ?? "").trim();
    if (!q || !explain || q.length > 400 || explain.length > 400) continue;
    if (r.type === "ox") {
      out.push({ type: "ox", q, answer: !!r.answer_bool, explain });
    } else if (r.type === "mc") {
      const choices = (r.choices ?? []).map((c) => String(c).trim());
      const ok = choices.length === 4 && choices.every((c) => c && c.length <= 200) && new Set(choices).size === 4 &&
        Number.isInteger(r.answer_index) && r.answer_index >= 0 && r.answer_index < 4;
      if (ok) out.push({ type: "mc", q, choices, answer: r.answer_index, explain });
    }
  }
  return out;
}

// ───────── 말투 (docs/quiz-authoring.md "말투" — 우리 문제 은행과 같게) ─────────
// 같은 규칙을 scripts/quizbank.py check 와 Supabase 함수에서도 씁니다.
const COND = String.raw`(\s*\([^()]*\))?`; // 끝에 붙는 조건 괄호: "… (원소 n개)"
const MC_END = new RegExp(String.raw`\?` + COND + "$");
const OX_END = new RegExp(String.raw`다\.` + COND + "$");
const OX_FORMAL = new RegExp(String.raw`니다\.` + COND + "$"); // OX는 "~입니다."가 아니라 "~이다."
const HAEYO = /(예요|에요|해요|어요|아요|이죠|죠|네요|군요)[.!?]?(\s|$)/;
const BANNED_Q = /(고르시오|고르세요|무엇일까|뭘까|인가요\?|일까요\?|\[AI\]|\[연습)/;
const NUMBERED = /^\s*(\d+[.)]\s|[①-⑳]|[A-Da-d][.)]\s)/;

/** 고쳐도 뜻이 바뀌지 않는 작은 말투 차이만 고침 (보기 번호·마침표, 앞뒤 공백) */
export function styleFix(q) {
  const out = { ...q, q: q.q.trim(), explain: q.explain.trim() };
  if (q.type === "mc") out.choices = q.choices.map((c) => c.trim().replace(NUMBERED, "").replace(/\.$/, "").trim());
  return out;
}

/** 말투 규칙에 어긋나는 점 목록 (빈 배열이면 통과) */
export function styleIssues(q) {
  const bad = [];
  if (q.type === "mc" && !MC_END.test(q.q)) bad.push("4지선다 문제는 '~은/는?'으로 끝나야 함");
  if (q.type === "ox" && (!OX_END.test(q.q) || OX_FORMAL.test(q.q))) bad.push("OX 문제는 해라체 '~다.'로 끝나야 함");
  if (BANNED_Q.test(q.q)) bad.push("문제에 쓰지 않는 말투");
  if (!q.explain.includes("니다")) bad.push("해설은 합니다체");
  if (HAEYO.test(q.explain) || HAEYO.test(q.q)) bad.push("해요체 금지");
  if (/(정답은?\s*\d+\s*번|\d+\s*번\s*보기|보기\s*\d+)/.test(q.explain)) bad.push("해설에 보기 번호");
  if (q.type === "mc" && q.choices.some((c) => NUMBERED.test(c) || /[^.]\.$/.test(c))) bad.push("보기에 번호·마침표");
  return bad;
}

// ───────── 출제 ─────────
function userPrompt(topic, existing, count) {
  const list = existing.length
    ? existing.map((q, i) => `${i + 1}. ${q}`).join("\n")
    : "(아직 없음)";
  return `개념: ${topic.ko} (영어: ${topic.en})
분야: ${topic.domain} > ${topic.category}
난이도: Lv.${topic.lv} ${topic.level}
참고 힌트: ${topic.hint}

이미 있는 문제 (이것과 비슷한 문제는 만들지 마세요):
${list}

위 문제들과 겹치지 않는 새로운 유형의 퀴즈 ${count}문제를 만들어 주세요.
말투는 위 "이미 있는 문제"와 지침의 "말투" 규칙을 그대로 따르세요 (4지선다 "~은/는?", OX "~다.", 해설 "~입니다/~합니다").`;
}

/** 연습용 가짜 출제 (QUIZ_MOCK=1). API 키 없이 앱·서버 흐름을 시험할 때 씀 */
// 연습 모드 문장: 주제 이름 뒤에 "개념"을 붙여 받침과 상관없이 조사가 맞게 함
const MOCK_MC = [
  (t) => `실제 현장에서 ${t.ko} 개념을 떠올려야 하는 상황으로 가장 알맞은 것은?`,
  (t) => `비슷한 개념들과 견주었을 때 ${t.ko} 개념만의 특징으로 알맞은 것은?`,
  (t) => `학생들이 흔히 잘못 아는 내용을 빼고 ${t.ko} 개념을 바르게 설명한 것은?`,
  (t) => `조건이 달라져도 ${t.ko} 개념에서 변하지 않는 핵심은?`,
  (t) => `원인과 결과로 볼 때 ${t.ko} 개념이 필요한 까닭에 가장 가까운 것은?`,
  (t) => `교과서 예제를 풀 때 ${t.ko} 개념을 이용하는 첫 단계로 알맞은 것은?`,
];
const MOCK_OX = [
  (t) => `${t.ko} 개념의 요점은 "${t.hint}"라고 말할 수 있다.`,
  (t) => `${t.en}라는 영어 이름은 ${t.ko} 개념을 가리킨다.`,
];

function mockGenerate(topic, count) {
  const mc = [...MOCK_MC].sort(() => Math.random() - 0.5);
  const ox = [...MOCK_OX].sort(() => Math.random() - 0.5);
  const out = [];
  for (let i = 0; i < count; i++) {
    if (i % 4 === 3 && ox.length) {
      out.push({ type: "ox", q: ox.pop()(topic), answer: true, explain: `연습 모드에서 만든 문제입니다. ${topic.ko} 개념의 핵심은 "${topic.hint}"입니다.` });
    } else if (mc.length) {
      out.push({
        type: "mc",
        q: mc.pop()(topic),
        choices: [topic.hint, `${topic.ko} 개념과 관계없는 설명 가`, `${topic.ko} 개념과 관계없는 설명 나`, `${topic.ko} 개념과 관계없는 설명 다`],
        answer: 0,
        explain: `연습 모드에서 만든 문제입니다. ${topic.ko} 개념의 핵심은 "${topic.hint}"입니다.`,
      });
    }
  }
  return out;
}

let client = null;

/**
 * existing(이미 있는 문제 문장들)을 먼저 보여 주고, 겹치지 않는 새 문제 count개를 만들어 달라고 요청.
 * 결과는 형식 검증 + 비슷한 문제 거르기를 거쳐 돌려줌.
 */
/** Claude에 구조화 출력으로 한 번 묻기 (출제·검수 공통) */
async function askJson(system, content, schema, effort = "medium") {
  client ??= new Anthropic(); // ANTHROPIC_API_KEY 환경 변수 사용
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 12000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: { type: "json_schema", schema } },
    system,
    messages: [{ role: "user", content }],
  });
  if (res.stop_reason === "refusal") throw new Error("refused");
  if (res.stop_reason === "max_tokens") throw new Error("truncated");
  return JSON.parse(res.content.filter((b) => b.type === "text").map((b) => b.text).join(""));
}

/** 새 문제 만들기 (검수 전). 형식·말투·중복 검사까지 */
async function draft(topic, existing, count) {
  const questions = process.env.QUIZ_MOCK === "1"
    ? mockGenerate(topic, count)
    : toQuestions((await askJson(readGem(), userPrompt(topic, existing, count), SCHEMA)).questions);
  // 말투 검사: 작은 차이는 고치고, 규칙에 어긋나는 문제는 버림
  const styled = questions.map(styleFix).filter((q) => !styleIssues(q).length);
  return distinct(styled, existing);
}

// ───────── 검수 2번 (만든 직후, 모든 문제) ─────────
// 1차: 정답표 없이 직접 풀어 보기 → 정답이 다르거나, 답이 둘일 수 있거나, 주제와 관계없거나, 사실이 틀리면 버림
// 2차: 정답·해설까지 보고 다시 확인 → 조금이라도 의심스러우면 버림
// 두 번 모두 통과한 문제만 창고에 넣고 학생에게 냅니다.
export const readReview = (n) => fs.readFileSync(path.join(HERE, `review${n}.md`), "utf8");

export const REVIEW1_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          answer_index: { type: "integer" },
          answer_bool: { type: "boolean" },
          ambiguous: { type: "boolean" },
          on_topic: { type: "boolean" },
          sound: { type: "boolean" },
          note: { type: "string" },
        },
        required: ["index", "answer_index", "answer_bool", "ambiguous", "on_topic", "sound", "note"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
};
export const REVIEW2_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          verdict: { type: "string", enum: ["keep", "drop"] },
          reason: { type: "string" },
        },
        required: ["index", "verdict", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
};

const topicLine = (t) => `개념: ${t.ko} (영어: ${t.en})\n분야: ${t.domain} > ${t.category}\n난이도: Lv.${t.lv} ${t.level}\n참고 힌트: ${t.hint}`;

/** 1차 검수에 보낼 문제: 정답·해설을 빼고 보냄 */
export function review1Prompt(topic, qs) {
  const list = qs.map((q, i) => (q.type === "mc"
    ? `[${i}] (4지선다) ${q.q}\n  0) ${q.choices[0]}\n  1) ${q.choices[1]}\n  2) ${q.choices[2]}\n  3) ${q.choices[3]}`
    : `[${i}] (OX) ${q.q}`)).join("\n\n");
  return `${topicLine(topic)}\n\n아래 문제를 정답표 없이 직접 풀고 판단해 주세요. OX 문제는 answer_index를 0으로, 4지선다는 answer_bool을 false로 두세요.\n\n${list}`;
}
/** 2차 검수에 보낼 문제: 정답·해설까지 보냄 */
export function review2Prompt(topic, qs) {
  const list = qs.map((q, i) => (q.type === "mc"
    ? `[${i}] (4지선다) ${q.q}\n  0) ${q.choices[0]}\n  1) ${q.choices[1]}\n  2) ${q.choices[2]}\n  3) ${q.choices[3]}\n  정답: ${q.answer}) ${q.choices[q.answer]}\n  해설: ${q.explain}`
    : `[${i}] (OX) ${q.q}\n  정답: ${q.answer ? "O" : "X"}\n  해설: ${q.explain}`)).join("\n\n");
  return `${topicLine(topic)}\n\n아래 문제를 정답표·해설까지 보고 판정해 주세요.\n\n${list}`;
}

/** 1차 결과로 통과 여부 판단: 직접 푼 답이 정답표와 같고, 답이 하나뿐이고, 주제에 맞고, 사실에 맞아야 통과 */
export function pass1(q, r) {
  if (!r || r.ambiguous || !r.on_topic || !r.sound) return false;
  return q.type === "mc" ? r.answer_index === q.answer : r.answer_bool === q.answer;
}

/** 연습 모드 검수: 힌트와 같은 보기를 정답으로 보고 풂 (정답표가 틀린 문제를 걸러 내는지 시험용) */
function mockReview1(topic, qs) {
  return qs.map((q, index) => ({
    index,
    answer_index: q.type === "mc" ? Math.max(0, q.choices.indexOf(topic.hint)) : 0,
    answer_bool: q.type === "ox" ? q.answer : false,
    ambiguous: q.type === "mc" && q.choices.filter((c) => c === topic.hint).length > 1,
    on_topic: q.q.includes(topic.ko) || q.q.includes(topic.en),
    sound: true,
    note: "연습 모드 검수",
  }));
}

/** 두 번 검수해서 둘 다 통과한 문제만 돌려줌. stats에 단계별 개수 */
export async function review(topic, qs) {
  const stats = { drafted: qs.length, pass1: 0, pass2: 0 };
  if (!qs.length) return { kept: [], stats };
  const mock = process.env.QUIZ_MOCK === "1";

  const r1 = mock ? mockReview1(topic, qs)
    : (await askJson(readReview(1), review1Prompt(topic, qs), REVIEW1_SCHEMA, "high")).results;
  const byIndex1 = new Map(r1.map((r) => [r.index, r]));
  const after1 = qs.filter((q, i) => pass1(q, byIndex1.get(i)));
  stats.pass1 = after1.length;
  if (!after1.length) return { kept: [], stats };

  const r2 = mock ? after1.map((_, index) => ({ index, verdict: "keep", reason: "연습 모드 검수" }))
    : (await askJson(readReview(2), review2Prompt(topic, after1), REVIEW2_SCHEMA, "high")).results;
  const byIndex2 = new Map(r2.map((r) => [r.index, r]));
  const kept = after1.filter((_, i) => byIndex2.get(i)?.verdict === "keep");
  stats.pass2 = kept.length;
  return { kept, stats };
}

/**
 * 새 문제 만들기 → 바로 2번 검수 → 통과한 문제만 돌려줌.
 * existing(이미 있는 문제 문장들)을 먼저 보여 주고 겹치지 않는 새 문제를 만들게 함.
 */
export async function generate(topic, existing, count) {
  const drafted = await draft(topic, existing, count);
  const { kept, stats } = await review(topic, drafted);
  generate.lastStats = stats;
  return kept;
}
