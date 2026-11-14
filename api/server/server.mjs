import http from 'node:http';
import {createBattleService} from '../mysql/battle-service.mjs';
import {battleRoutes} from '../mysql/battle-http.mjs';
import {createSpeedService} from '../mysql/speed-service.mjs';
import {speedRoutes} from '../mysql/speed-http.mjs';
process.env.TZ = 'Asia/Seoul';
import {createMemberService} from '../mysql/member-service.mjs';
import {memberRoutes} from '../mysql/member-http.mjs';
import { pathToFileURL } from 'node:url';
import { hash, loadBank, loadTopics } from '../shared/question-store.mjs';
import { createReadPool, safeError } from './db.mjs';
import { databaseStore } from './db-store.mjs';
import { createAuth } from './auth.mjs';
import { authRoutes } from './auth-http.mjs';
import { kakaoRoutes } from './kakao.mjs';
import { createAccountService } from '../mysql/account-service.mjs';
import { accountRoutes } from '../mysql/account-http.mjs';
import { createRecordService } from '../mysql/record-service.mjs';
import { recordRoutes } from '../mysql/record-http.mjs';

export function createServer({ topics = loadTopics(), bank, store, auth, authLimits, battleService, battleSweep=true, kakao } = {}) {
  const battles=auth?(battleService??createBattleService({auth})):null;
  const handleBattle=battles?battleRoutes(battles):null;
  const handleSpeed=auth ? speedRoutes(createSpeedService({auth})) : null;
  const handleMember=auth ? memberRoutes(createMemberService({auth})) : null;
  const handleAuth=auth ? authRoutes(auth,{limits:authLimits}) : null;
  // 카카오 로그인: KAKAO_REST_API_KEY, KAKAO_REDIRECT_URI 환경변수가 있을 때만 켜짐
  const handleKakao=auth ? kakaoRoutes(auth,kakao) : null;
  const handleAccount=auth ? accountRoutes(createAccountService({auth})) : null;
  const handleRecords=auth ? recordRoutes(createRecordService({auth})) : null;
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
      res.end(status === 204 || status === 304 ? undefined : JSON.stringify(body));
    };
    if (req.method === 'OPTIONS') return send(204);
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname).replace(/^\/api(?=\/)/, ''); }
    catch { return send(400, { error: 'bad_request' }); }
    try {
    if(handleBattle && await handleBattle(req,pathname,send)) return;
    if(handleSpeed && await handleSpeed(req,pathname,send)) return;
    if(handleMember && await handleMember(req,pathname,send)) return;
    if(handleKakao && await handleKakao(req,pathname,send)) return;
    if(handleAuth && await handleAuth(req,pathname,send)) return;
    if(handleAccount && await handleAccount(req,pathname,send)) return;
    if(handleRecords && await handleRecords(req,pathname,send)) return;
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
  server.on('close',()=>clearInterval(timer));
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = process.env.MYSQL_USER ? await createReadPool() : null;
  const server = createServer(db ? { store:databaseStore(db),auth:createAuth() } : {});
  for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => server.close(async () => { await db?.end(); }));
  server.listen(Number(process.env.PORT || 8788), process.env.HOST || '127.0.0.1', () => {
    console.log(`Question API listening on ${JSON.stringify(server.address())}`);
  });
}
