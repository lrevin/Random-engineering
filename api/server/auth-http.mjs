import { AuthError } from './auth.mjs';
import { clientIp, overLimit } from './client-key.mjs';

export async function readJsonBody(req,{maxBytes=16384}={}) {
  if(!req.headers['content-type']?.toLowerCase().startsWith('application/json')) throw new AuthError('bad_request');
  let size=0; const chunks=[];
  for await (const chunk of req) {
    size+=chunk.length;
    if(size<=maxBytes) chunks.push(chunk);
  }
  if(size>maxBytes) throw new AuthError('payload_too_large',413);
  let value;
  try { value=JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AuthError('bad_request'); }
  if(!value || typeof value!=='object' || Array.isArray(value)) throw new AuthError('bad_request');
  return value;
}

/** 같은 이메일로 15분 동안 비밀번호를 이만큼 틀리면 그 이메일 로그인을 잠시 막음 (IP를 바꿔 가며 한 계정을 맞히는 것 방지) */
export const LOGIN_FAIL_LIMIT=10, LOGIN_FAIL_WINDOW_MS=15*60000;

export function authRoutes(auth,{limits={signup:5,login:10,refresh:60,logout:60,me:600}}={}) {
  const hits=new Map(), fails=new Map();
  return async (req,pathname,send)=>{
    const match=/^\/auth\/(signup|login|refresh|logout|me)$/.exec(pathname);
    if(!match) return false;
    const route=match[1];
    const reply=(status,data)=>send(status,data,{'Cache-Control':'no-store','Pragma':'no-cache'});
    if(req.method!==(route==='me'?'GET':'POST')) {reply(405,{error:'method_not_allowed'});return true;}
    const now=Date.now();
    // Nginx connections share one socket address. Verified sessions must not share a quota.
    let subject;
    if(route==='me'){try{subject=(await auth.verifyAccess(req.headers.authorization)).sub;}catch{/* Invalid tokens retain the address quota. */}}
    const key=subject?`member:${subject}:${route}`:`${clientIp(req)}:${route}`;
    if(overLimit(hits,key,limits[route] ?? 60,now)) {reply(429,{error:'rate_limited'});return true;}
    let failKey=null;
    try {
      const body=route==='me'?null:await readJsonBody(req);
      if(route==='login'&&typeof body.email==='string'){
        failKey=body.email.trim().toLowerCase().slice(0,254);
        const f=fails.get(failKey);
        if(f&&f.until>now&&f.n>=LOGIN_FAIL_LIMIT) {reply(429,{error:'too_many_attempts'});return true;}
      }
      const result=route==='me'? await auth.me(req.headers.authorization): await auth[route](body);
      if(failKey) fails.delete(failKey);
      reply(route==='signup'?201:route==='logout'?204:200,result);
    } catch(error) {
      if(!(error instanceof AuthError)) throw error;
      if(failKey&&error.code==='invalid_credentials'){
        let f=fails.get(failKey);
        if(!f||f.until<=now){ if(fails.size>=10000) fails.delete(fails.keys().next().value); f={until:now+LOGIN_FAIL_WINDOW_MS,n:0}; fails.set(failKey,f); }
        f.n++;
      }
      reply(error.status,{error:error.code});
    }
    return true;
  };
}
