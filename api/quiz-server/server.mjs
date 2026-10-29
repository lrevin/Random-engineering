// 뽑공 퀴즈 AI 서버 — 개인 PC든 클라우드든 계속 켜 두고 퀴즈를 찍어내는 출제 AI
//
//   POST /quiz   { topicId, count?, avoid?, fresh? }  → { questions, fresh }
//   GET  /health                               → 상태
//
// 동작:
//   1) 주제마다 AI 문제 "창고(pool)"를 파일로 쌓아 둡니다 (data/pools/<topicId>.json).
//   2) 요청이 오면 창고에서 우리 문제 은행(app/src/data/quizbank)·앱이 보낸 문제(avoid)와 비슷하지 않은 문제를
//      덜 낸 것부터 골라 줍니다. 창고가 모자라면 그때 새로 만듭니다.
//   3) 새로 만들 때는 우리 문제 은행 + 창고에 이미 있는 문제를 AI에게 먼저 보여 주고 겹치지 않는 새 유형으로 내게 합니다.
//      만든 직후 모든 문제를 2번 검수합니다 (1차: 정답표 없이 직접 풀기, 2차: 정답·해설 대조). 둘 다 통과한 문제만 창고에 넣습니다.
//   * fresh: true (앱이 공부 시작을 누른 즉시 보내는 요청) 이면 그 자리에서 새로 만들고 검수한 문제를 먼저 줍니다.
//   4) QUIZ_WARM=1 이면 쉬는 동안에도 창고가 빈 주제부터 계속 문제를 만들어 둡니다.
//
// 실행: api/quiz-server/README.md

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { distinct, generate, loadBank, loadTopics, MODEL, styleIssues } from "./core.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const TOKEN = process.env.QUIZ_TOKEN || "";
const BATCH = Number(process.env.QUIZ_BATCH || 8); // 한 번에 새로 만드는 문제 수 (검수에서 버려질 몫까지)
const POOL_TARGET = Number(process.env.QUIZ_POOL_TARGET || 12); // 주제마다 미리 쌓아 둘 문제 수
const WARM = process.env.QUIZ_WARM === "1";
const WARM_INTERVAL = Number(process.env.QUIZ_WARM_INTERVAL || 30) * 1000;
const POOL_DIR = path.join(HERE, "data", "pools");
fs.mkdirSync(POOL_DIR, { recursive: true });

const TOPICS = loadTopics();
const BANK = loadBank();
const bankTexts = (id) => (BANK[id] ?? []).map((q) => q.q);

// ───────── 창고 (주제별 AI 문제) ─────────
const poolFile = (id) => path.join(POOL_DIR, `${id}.json`);
function readPool(id) {
  try {
    return JSON.parse(fs.readFileSync(poolFile(id), "utf8"));
  } catch {
    return [];
  }
}
const writePool = (id, pool) => fs.writeFileSync(poolFile(id), JSON.stringify(pool, null, 1));

// 같은 주제를 동시에 두 번 만들지 않도록 주제별로 줄 세움
const locks = new Map();
function withLock(id, fn) {
  const prev = locks.get(id) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(id, next.catch(() => {}));
  return next;
}

/** 새 문제를 만들어 창고에 넣음. 우리 문제 은행 + 창고 문제 + extra(앱이 보낸 문제)를 먼저 보여 줌 */
async function refill(id, extra = [], size = BATCH) {
  const topic = TOPICS[id];
  const pool = readPool(id);
  const existing = [...bankTexts(id), ...pool.map((q) => q.q), ...extra];
  const made = await generate(topic, existing, size);
  const st = generate.lastStats;
  const now = new Date().toISOString();
  const fresh = made.map((q) => ({ ...q, createdAt: now, served: 0, reviewed: 2, model: process.env.QUIZ_MOCK === "1" ? "mock" : MODEL }));
  writePool(id, [...pool, ...fresh]);
  log(`+${fresh.length} ${id} (${topic.ko}) 만듦 ${st.drafted} → 1차 검수 ${st.pass1} → 2차 검수 ${st.pass2} · 창고 ${pool.length + fresh.length}개`);
  return fresh;
}

/**
 * count개를 골라 줌. 은행·avoid와 비슷하지 않고 2번 검수를 통과한 것 중에서.
 * fresh면 지금 새로 만든(검수 통과) 문제를 먼저, 아니면 덜 낸 것부터.
 */
async function serve(id, count, avoid, fresh) {
  return withLock(id, async () => {
    const against = [...bankTexts(id), ...avoid];
    // 검수를 통과한 문제만, 말투 규칙이 바뀌어도 예전 문제가 섞이지 않게 꺼낼 때도 검사
    const usable = () => distinct(readPool(id).filter((q) => q.reviewed === 2 && !styleIssues(q).length), against);
    let made = [];
    if (fresh || usable().length < count) {
      try {
        made = await refill(id, avoid, Math.max(BATCH, count * 2));
      } catch (e) {
        if (!usable().length) throw e;
        log(`! ${id} 새로 만들기 실패, 창고 문제로 대신: ${e.message}`);
      }
    }
    const newQs = new Set(made.map((q) => q.q));
    const pool = readPool(id);
    const chosen = usable()
      .sort((a, b) => Number(newQs.has(b.q)) - Number(newQs.has(a.q)) || a.served - b.served || Math.random() - 0.5)
      .slice(0, count);
    for (const q of chosen) {
      const p = pool.find((x) => x.q === q.q);
      if (p) p.served += 1;
    }
    writePool(id, pool);
    const out = chosen.map(({ type, q, choices, answer, explain }) => (type === "mc" ? { type, q, choices, answer, explain } : { type, q, answer, explain }));
    return { questions: out, fresh: chosen.filter((q) => newQs.has(q.q)).length };
  });
}

// ───────── 쉬는 동안 계속 만들기 ─────────
async function warmLoop() {
  const ids = Object.keys(TOPICS);
  for (;;) {
    // 문제 은행이 적은 주제, 창고가 빈 주제부터
    const need = ids
      .map((id) => ({ id, have: readPool(id).length + (BANK[id]?.length ?? 0) / 3 }))
      .filter((x) => readPool(x.id).length < POOL_TARGET)
      .sort((a, b) => a.have - b.have);
    if (!need.length) {
      log("모든 주제 창고가 찼어요. 10분 뒤 다시 확인합니다.");
      await sleep(10 * 60 * 1000);
      continue;
    }
    const { id } = need[0];
    try {
      await withLock(id, () => refill(id));
    } catch (e) {
      log(`! ${id} 만들기 실패: ${e.message}`);
    }
    await sleep(WARM_INTERVAL);
  }
}

// ───────── HTTP ─────────
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-quiz-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const send = (res, status, body) => {
  res.writeHead(status, { ...CORS, "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
};

// IP마다 1분에 30번까지
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 60000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 30;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 64 * 1024) reject(new Error("too large"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const url = new URL(req.url, "http://x");

  if (req.method === "GET" && url.pathname === "/health") {
    const pools = fs.readdirSync(POOL_DIR).filter((f) => f.endsWith(".json"));
    const stocked = pools.reduce((a, f) => a + readPool(f.replace(/\.json$/, "")).length, 0);
    return send(res, 200, { ok: true, model: process.env.QUIZ_MOCK === "1" ? "mock" : MODEL, topics: Object.keys(TOPICS).length, pools: pools.length, stocked, warm: WARM });
  }
  if (req.method !== "POST" || url.pathname !== "/quiz") return send(res, 404, { error: "not found" });
  if (TOKEN && req.headers["x-quiz-token"] !== TOKEN) return send(res, 401, { error: "bad token" });
  if (limited(req.socket.remoteAddress ?? "")) return send(res, 429, { error: "rate limited" });

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return send(res, 400, { error: "bad request" });
  }
  const id = String(body?.topicId ?? "");
  if (!TOPICS[id]) return send(res, 400, { error: "unknown topic" });
  const count = Math.min(7, Math.max(1, Number(body?.count) || 4));
  const avoid = (Array.isArray(body?.avoid) ? body.avoid : []).slice(0, 40).map((s) => String(s).slice(0, 400));
  const fresh = body?.fresh === true;

  try {
    const { questions, fresh: madeNow } = await serve(id, count, avoid, fresh);
    log(`→ ${id} ${questions.length}문제 보냄 (방금 만들고 검수한 문제 ${madeNow}개)`);
    return send(res, 200, { questions, fresh: madeNow });
  } catch (e) {
    log(`! ${id} 실패: ${e.message}`);
    const status = e?.status === 429 ? 429 : 502;
    return send(res, status, { error: "generation failed" });
  }
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => console.log(`[${new Date().toLocaleTimeString("ko-KR")}] ${m}`);

if (!process.env.ANTHROPIC_API_KEY && process.env.QUIZ_MOCK !== "1") {
  console.error("ANTHROPIC_API_KEY 환경 변수가 없어요. 키 없이 시험하려면 QUIZ_MOCK=1 로 켜세요.");
  process.exit(1);
}
server.listen(PORT, HOST, () => {
  log(`퀴즈 AI 서버 시작: http://${HOST}:${PORT}  (모델 ${process.env.QUIZ_MOCK === "1" ? "mock" : MODEL}, 주제 ${Object.keys(TOPICS).length}개, 문제 은행 ${Object.keys(BANK).length}개 주제)`);
  if (WARM) {
    log(`쉬는 동안 계속 출제: 주제마다 ${POOL_TARGET}문제까지, ${WARM_INTERVAL / 1000}초 간격`);
    warmLoop();
  }
});
