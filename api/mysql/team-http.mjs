import {AuthError} from '../server/auth.mjs';
import {rateKey,overLimit} from '../server/client-key.mjs';
import {readJsonBody} from '../server/auth-http.mjs';
// 스터디 팀 (/me/team…) · 오답 보스전 (/me/boss…) — api/API_RULES.md "스터디 팀 · 오답 보스전"
export function teamRoutes(teams,bosses){const hits=new Map();return async(req,path,send)=>{
 const isTeam=path==='/me/team'||path.startsWith('/me/team/'),isBoss=path==='/me/boss'||path.startsWith('/me/boss/');
 if(!isTeam&&!isBoss)return false;
 const reply=(n,b)=>send(n,b,{'Cache-Control':'no-store'});
 const now=Date.now(),key=rateKey(req);
 if(overLimit(hits,key,600,now)){reply(429,{error:'rate_limited'});return true;}
 try{const header=req.headers.authorization,m=req.method;
  const invite=/^\/me\/team\/invites\/([0-9a-f-]+)\/(accept|decline|cancel)$/.exec(path),run=/^\/me\/boss\/runs\/([0-9a-f-]+)(\/answers)?$/.exec(path);
  if(path==='/me/team'&&m==='GET')reply(200,await teams.status(header));
  else if(path==='/me/team/invites'&&m==='POST')reply(200,await teams.invite(header,await readJsonBody(req)));
  else if(invite&&m==='POST')reply(200,await teams.respond(header,invite[1],invite[2]));
  else if(path==='/me/team/create'&&m==='POST')reply(200,await teams.create(header,await readJsonBody(req)));
  else if(path==='/me/team/leave'&&m==='POST')reply(200,await teams.leave(header));
  else if(path==='/me/team/claim'&&m==='POST')reply(200,await teams.claim(header));
  else if(path==='/me/boss'&&m==='GET')reply(200,await bosses.status(header));
  else if(path==='/me/boss/runs'&&m==='POST')reply(200,await bosses.start(header,await readJsonBody(req)));
  else if(run&&run[2]&&m==='POST')reply(200,await bosses.answer(header,run[1],await readJsonBody(req)));
  else if(run&&!run[2]&&m==='GET')reply(200,await bosses.run(header,run[1]));
  else reply(405,{error:'method_not_allowed'});
 }catch(e){if(!(e instanceof AuthError))throw e;reply(e.status,{error:e.code});}return true;
};}
