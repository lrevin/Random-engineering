// 퀴즈 AI 서버 자체 점검 (API 키 없이 연습 모드로 실행)
// 사용법: cd api/quiz-server && npm test

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBank, similarity, SIMILAR, styleIssues } from "./core.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 18787;
const TOPIC = Object.keys(loadBank())[0]; // 문제 은행이 있는 주제
const poolFile = path.join(HERE, "data", "pools", `${TOPIC}.json`);
const backup = fs.existsSync(poolFile) ? fs.readFileSync(poolFile) : null;
if (backup) fs.rmSync(poolFile);

const child = spawn(process.execPath, ["server.mjs"], { cwd: HERE, env: { ...process.env, QUIZ_MOCK: "1", PORT: String(PORT) }, stdio: "inherit" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (body) => fetch(`http://127.0.0.1:${PORT}/quiz`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json().then((j) => ({ status: r.status, ...j })));

let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? "✓" : "✗"} ${msg}`); if (!ok) failed++; };

try {
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/health`)).ok) break; } catch { /* 아직 켜지는 중 */ }
    await sleep(250);
  }
  const bank = loadBank()[TOPIC].map((q) => q.q);
  const a = await post({ topicId: TOPIC, count: 4, avoid: bank });
  check(a.status === 200 && a.questions.length === 4, `첫 요청: 4문제 (${a.questions?.length})`);
  check(a.questions.every((q) => bank.every((b) => similarity(q.q, b) < SIMILAR)), "문제 은행과 비슷한 문제 없음");
  check(a.questions.every((q) => !styleIssues(q).length), "AI 문제 말투가 문제 은행 규칙과 같음");
  check(loadBank()[TOPIC].every((q) => !styleIssues(q).length), "문제 은행도 같은 말투 규칙 통과");
  const wrongTone = [
    { type: "mc", q: "다음 중 옳은 것을 고르시오.", choices: ["가", "나", "다", "라"], answer: 0, explain: "가가 맞습니다." },
    { type: "ox", q: "큐는 선입선출 구조입니다.", answer: true, explain: "큐는 FIFO입니다." },
    { type: "mc", q: "큐의 특징은?", choices: ["선입선출", "후입선출", "무작위", "우선순위"], answer: 0, explain: "큐는 먼저 넣은 것이 먼저 나와요." },
  ];
  check(wrongTone.every((q) => styleIssues(q).length), "말투가 다른 문제는 걸러 냄 (고르시오 / ~입니다. / ~나와요)");
  const b = await post({ topicId: TOPIC, count: 4 });
  check(b.status === 200 && b.questions.length === 4, "두 번째 요청: 4문제");
  const overlap = b.questions.filter((q) => a.questions.some((x) => x.q === q.q)).length;
  check(overlap <= 2, `덜 낸 문제부터 골라 줌 (겹친 문제 ${overlap}개)`);
  check((await post({ topicId: "없는-주제" })).status === 400, "없는 주제는 거절");
  const h = await (await fetch(`http://127.0.0.1:${PORT}/health`)).json();
  check(h.ok && h.stocked >= 4, `창고에 문제가 쌓임 (${h.stocked}개)`);
} finally {
  child.kill();
  if (fs.existsSync(poolFile)) fs.rmSync(poolFile);
  if (backup) fs.writeFileSync(poolFile, backup);
}
console.log(failed ? `실패 ${failed}개` : "모두 통과");
process.exit(failed ? 1 : 0);
