import {createQuizJobWorker} from '../mysql/quiz-job-service.mjs';
import {createActivityService} from '../mysql/activity-service.mjs';
import {activityRoutes} from '../mysql/activity-http.mjs';
import http from 'node:http';
import {createBattleService} from '../mysql/battle-service.mjs';
import {battleRoutes} from '../mysql/battle-http.mjs';
import {createSpeedService} from '../mysql/speed-service.mjs';
import {speedRoutes} from '../mysql/speed-http.mjs';
import {createTeamService} from '../mysql/team-service.mjs';
import {teamRoutes} from '../mysql/team-http.mjs';
import {createBossService} from '../mysql/boss-service.mjs';
process.env.TZ = 'Asia/Seoul';
import {createMemberService} from '../mysql/member-service.mjs';
import {memberRoutes} from '../mysql/member-http.mjs';
import { pathToFileURL } from 'node:url';
import { hash, loadBank, loadTopics } from '../shared/question-store.mjs';
import { closeSharedPool, createReadPool, safeError, useSharedPool } from './db.mjs';
import { databaseStore } from './db-store.mjs';
import { createAuth } from './auth.mjs';
import { authRoutes } from './auth-http.mjs';
import { kakaoRoutes } from './kakao.mjs';
import { adRewardRoutes, createAdRewardService } from '../mysql/ad-reward.mjs';
import { createAccountService } from '../mysql/account-service.mjs';
import { accountRoutes } from '../mysql/account-http.mjs';
import { createRecordService } from '../mysql/record-service.mjs';
import { recordRoutes } from '../mysql/record-http.mjs';
import { createLeaderboardService } from '../mysql/leaderboard-service.mjs';
import { leaderboardRoutes } from '../mysql/leaderboard-http.mjs';
import { createProgressService } from '../mysql/progress-service.mjs';
import { progressRoutes } from '../mysql/progress-http.mjs';
import { clientErrorRoutes } from './client-errors.mjs';
import { quizProxyRoutes } from './quiz-proxy.mjs';
import { createPush } from './push.mjs';
import { createSubscriptionService } from '../mysql/subscription-service.mjs';
import { subscriptionRoutes } from '../mysql/subscription-http.mjs';
import { createMailer } from './mailer.mjs';
import { createPasswordReset, passwordResetRoutes } from './password-reset.mjs';
import { createNotifier } from '../mysql/notifier-service.mjs';
import { purgeExpiredAccounts } from '../mysql/account-service.mjs';
import { clientIp, overLimit } from './client-key.mjs';

export function createServer({ topics = loadTopics(), bank, store, auth, authLimits, battleService, battleSweep=true, kakao, quiz, ipLimit=Number(process.env.IP_RATE_LIMIT || 1200), push = auth ? createPush() : null, subscriptions = auth ? createSubscriptionService({ auth }) : null, renewEveryMs = 10 * 60 * 1000, passwordReset = auth ? createPasswordReset({ mailer: createMailer() }) : null, notifier = auth && push ? createNotifier({ push }) : null, purgeEveryMs = 60 * 60 * 1000 } = {}) {
  // 비밀번호 찾기 (메일 설정 SMTP_* 이 있을 때만)
  const handlePasswordReset=passwordReset ? passwordResetRoutes(passwordReset) : null;
  // 뽑공 프리미엄 월 구독 (토스페이먼츠 자동결제). TOSS_CLIENT_KEY · TOSS_SECRET_KEY 가 있을 때만 결제가 켜짐
  const handleSubscription=subscriptions ? subscriptionRoutes(subscriptions) : null;
  // 이전 직접 AI 경로는 학습 발급 경로로 안내한다. 생성 요청은 영속 작업 처리기가 담당.
  const handleQuiz=auth ? quizProxyRoutes(auth,quiz) : null;
  // 전체 요청을 실제 주소(IP)마다 분당 ipLimit번까지: 경로별 제한은 토큰 속 회원 id로 세서, 가짜 토큰을 바꿔 가며 보내면 피할 수 있음
  const ipHits=new Map();
  const battles=auth?(battleService??createBattleService({auth,push})):null;
  const handleBattle=battles?battleRoutes(battles):null;
  const handleActivity=auth?activityRoutes(createActivityService({auth})):null;
  const handleSpeed=auth ? speedRoutes(createSpeedService({auth})) : null;
  // 스터디 팀 · 오답 보스전
  const handleTeam=auth ? teamRoutes(createTeamService({auth}),createBossService({auth})) : null;
  const handleMember=auth ? memberRoutes(createMemberService({auth,push})) : null;
  const handleAuth=auth ? authRoutes(auth,{limits:authLimits}) : null;
  // 카카오 로그인: KAKAO_REST_API_KEY, KAKAO_REDIRECT_URI 환경변수가 있을 때만 켜짐
  const handleKakao=auth ? kakaoRoutes(auth,kakao) : null;
  // AdMob 보상형 광고 서버 측 확인 (구글이 직접 호출)
  const handleAds=auth ? adRewardRoutes(createAdRewardService()) : null;
  const handleAccount=auth ? accountRoutes(createAccountService({auth})) : null;
  const handleRecords=auth ? recordRoutes(createRecordService({auth})) : null;
  // 분야별 전체 유저 랭킹
  const handleLeaderboard=auth ? leaderboardRoutes(createLeaderboardService({auth})) : null;
  // 모의고사 · 오답 해결 · 복습 · 자격증 시험일 계정 보관
  const handleProgress=auth ? progressRoutes(createProgressService({auth})) : null;
  // 앱 화면 오류 보고 (서버 로그에만 남김)
  const handleClientErrors=clientErrorRoutes();
  if (!store) {
    bank ??= loadBank(undefined, topics);
    store = {
      health: async () => ({ ok:true,storage:'json',topics:Object.keys(topics).length,bankTopics:Object.keys(bank).length,
        questions:Object.values(bank).reduce((n,qs)=>n+qs.length,0),auth:'not_implemented',records:'not_implemented' }),
      questions: async id => Object.hasOwn(topics,id) ? bank[id] ?? [] : null,
    };
  }
  const server=http.createServer(async (req, res) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type, if-none-match, authorization',
      'Access-Control-Expose-Headers': 'etag', 'Content-Type': 'application/json; charset=utf-8' };
    const send = (status, body, extra = {}) => {
      res.writeHead(status, { ...headers, ...extra });
      res.end(status === 204 || status === 304 || body === undefined ? undefined : JSON.stringify(body));
    };
    // HTML 같은 JSON이 아닌 응답 (결제 페이지)
    const raw = (status, text, extra = {}) => { res.writeHead(status, extra); res.end(text); };
    if (req.method === 'OPTIONS') return send(204);
    if (overLimit(ipHits, clientIp(req), ipLimit)) return send(429, { error: 'rate_limited' }, { 'Retry-After': '60' });
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname).replace(/^\/api(?=\/)/, ''); }
    catch { return send(400, { error: 'bad_request' }); }
    try {
    if(handleActivity && await handleActivity(req,pathname,send)) return;
    if(handleBattle && await handleBattle(req,pathname,send)) return;
    if(handleSpeed && await handleSpeed(req,pathname,send)) return;
    if(handleTeam && await handleTeam(req,pathname,send)) return;
    if(handleMember && await handleMember(req,pathname,send)) return;
    if(handleKakao && await handleKakao(req,pathname,send)) return;
    if(handleAds && await handleAds(req,pathname,send)) return;
    if(handlePasswordReset && await handlePasswordReset(req,pathname,send)) return;
    if(handleAuth && await handleAuth(req,pathname,send)) return;
    if(handleAccount && await handleAccount(req,pathname,send)) return;
    if(handleRecords && await handleRecords(req,pathname,send)) return;
    if(handleLeaderboard && await handleLeaderboard(req,pathname,send)) return;
    if(handleProgress && await handleProgress(req,pathname,send)) return;
    if(handleQuiz && await handleQuiz(req,pathname,send)) return;
    if(handleSubscription && await handleSubscription(req,pathname,send,raw)) return;
    if(await handleClientErrors(req,pathname,send)) return;
    if (req.method === 'GET' && pathname === '/health') return send(200, {...await store.health(),auth:auth?'mysql':'not_implemented',profile:auth?'mysql':'not_implemented',accountDeletion:auth?'mysql':'not_implemented',records:auth?'mysql':'not_implemented',kakao:!!handleKakao});
    if(req.method==='GET' && pathname==='/catalog' && store.catalog){const data=await store.catalog();const etag=`"${hash(data)}"`;if(req.headers['if-none-match']===etag)return send(304,undefined,{ETag:etag});return send(200,{...data,version:hash(data)},{ETag:etag});}
    const match = /^\/quiz-bank\/([a-z0-9-]{1,32})$/.exec(pathname);
    if (req.method !== 'GET' || !match) return send(404, { error: 'not_found' });
    const questions = await store.questions(match[1]);
    if (questions === null) return send(404, { error:'not_found' });
    const etag = `"${hash(questions)}"`;
    if (req.headers['if-none-match'] === etag) return send(304, undefined, { ETag: etag });
    send(200, { questions }, { ETag: etag, 'Cache-Control': 'public, max-age=300' });
    } catch (error) {
      console.error(`Question API: ${safeError(error)}`);
      send(503, { error:'database_unavailable' },{'Cache-Control':'no-store'});
    }
  });
  let sweeping=false,timer;
  server.on('listening',()=>{if(battles&&battleSweep)timer=setInterval(async()=>{if(sweeping)return;sweeping=true;try{await battles.sweep();}catch(e){console.error('Battle sweep: '+safeError(e));}finally{sweeping=false;}},5000).unref();});
  // 결제일이 된 구독 자동결제 (토스 키가 있을 때만)
  let renewing=false,renewTimer;
  server.on('listening',()=>{if(subscriptions?.enabled&&renewEveryMs)renewTimer=setInterval(async()=>{if(renewing)return;renewing=true;try{await subscriptions.renewDue();}catch(e){console.error('Subscription renew: '+safeError(e));}finally{renewing=false;}},renewEveryMs).unref();});
  // 예약 알림(주간 리포트 · 팀 응원) 10분마다 · 탈퇴 30일 지난 계정 정리 1시간마다
  let notifyTimer,purgeTimer,purging=false;
  server.on('listening',()=>{
    if(notifier&&renewEveryMs)notifyTimer=setInterval(()=>{notifier.tick().catch(()=>{});},renewEveryMs).unref();
    if(auth&&purgeEveryMs)purgeTimer=setInterval(async()=>{if(purging)return;purging=true;try{await subscriptions?.releaseDeleted?.();const r=await purgeExpiredAccounts();if(r.deleted)console.log(`Purged accounts: ${r.deleted}`);}catch(e){console.error('Account purge: '+safeError(e));}finally{purging=false;}},purgeEveryMs).unref();
  });
  server.on('close',()=>{clearInterval(timer);clearInterval(renewTimer);clearInterval(notifyTimer);clearInterval(purgeTimer);});
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = process.env.MYSQL_USER ? await createReadPool() : null;
  if (db) useSharedPool();
  const server = createServer(db ? { store:databaseStore(db),auth:createAuth() } : {});
  const quizWorker=db?createQuizJobWorker():null;
  server.once('listening',()=>quizWorker?.start());
  server.once('close',()=>quizWorker?.stop());
  for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => { quizWorker?.stop(); server.close(async () => { await db?.end(); await closeSharedPool(); }); });
  server.listen(Number(process.env.PORT || 8788), process.env.HOST || '127.0.0.1', () => {
    console.log(`Question API listening on ${JSON.stringify(server.address())}`);
  });
}
