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

위 문제들과 겹치지 않는 새로운 유형의 퀴즈 ${count}문제를 만들어 주세요.`;
}

/** 연습용 가짜 출제 (QUIZ_MOCK=1). API 키 없이 앱·서버 흐름을 시험할 때 씀 */
const MOCK_MC = [
  (t) => `[연습 AI] 실제 현장에서 ${t.ko}를 떠올려야 하는 상황으로 가장 알맞은 것은?`,
  (t) => `[연습 AI] 비슷한 개념들과 견주었을 때 ${t.ko}만의 특징을 고르면?`,
  (t) => `[연습 AI] 학생들이 흔히 잘못 아는 내용을 빼고, ${t.ko}의 올바른 설명만 고르시오.`,
  (t) => `[연습 AI] 조건이 달라져도 ${t.ko}에서 변하지 않는 핵심은 무엇일까?`,
  (t) => `[연습 AI] 원인과 결과 관계로 볼 때 ${t.ko}가 일어나는 까닭에 가장 가까운 것은?`,
  (t) => `[연습 AI] 교과서 예제를 풀 때 ${t.ko}를 이용하는 첫 단계는?`,
];
const MOCK_OX = [
  (t) => `[연습 AI] ${t.ko}의 요점을 한 줄로 줄이면 "${t.hint}"라고 말할 수 있다.`,
  (t) => `[연습 AI] ${t.en}라는 영어 이름은 ${t.ko}를 가리킨다.`,
];

function mockGenerate(topic, count) {
  const mc = [...MOCK_MC].sort(() => Math.random() - 0.5);
  const ox = [...MOCK_OX].sort(() => Math.random() - 0.5);
  const out = [];
  for (let i = 0; i < count; i++) {
    if (i % 4 === 3 && ox.length) {
      out.push({ type: "ox", q: ox.pop()(topic), answer: true, explain: `${topic.ko}: ${topic.hint}` });
    } else if (mc.length) {
      out.push({
        type: "mc",
        q: mc.pop()(topic),
        choices: [topic.hint, `${topic.ko}와 관계없는 설명 ①`, `${topic.ko}와 관계없는 설명 ②`, `${topic.ko}와 관계없는 설명 ③`],
        answer: 0,
        explain: `(연습용 가짜 문제) ${topic.ko}: ${topic.hint}`,
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
export async function generate(topic, existing, count) {
  let questions;
  if (process.env.QUIZ_MOCK === "1") {
    questions = mockGenerate(topic, count);
  } else {
    client ??= new Anthropic(); // ANTHROPIC_API_KEY 환경 변수 사용
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 12000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: readGem(),
      messages: [{ role: "user", content: userPrompt(topic, existing, count) }],
    });
    if (res.stop_reason === "refusal") throw new Error("refused");
    if (res.stop_reason === "max_tokens") throw new Error("truncated");
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    questions = toQuestions(JSON.parse(text).questions);
  }
  return distinct(questions, existing);
}
