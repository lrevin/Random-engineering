import { AuthError } from './auth.mjs';

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

export function authRoutes(auth,{limits={signup:5,login:10,refresh:60,logout:60,me:600}}={}) {
  const hits=new Map();
  return async (req,pathname,send)=>{
    const match=/^\/auth\/(signup|login|refresh|logout|me)$/.exec(pathname);
    if(!match) return false;
    const route=match[1];
    const reply=(status,data)=>send(status,data,{'Cache-Control':'no-store','Pragma':'no-cache'});
    if(req.method!==(route==='me'?'GET':'POST')) {reply(405,{error:'method_not_allowed'});return true;}
    const now=Date.now();
    for(const [key,value] of hits) if(value.until<=now) hits.delete(key);
    // Nginx connections share one socket address. Verified sessions must not share a quota.
    let subject;
    if(route==='me'){try{subject=(await auth.verifyAccess(req.headers.authorization)).sub;}catch{/* Invalid tokens retain the address quota. */}}
    const key=subject?`member:${subject}:${route}`:`${req.socket.remoteAddress}:${route}`;
    const hit=hits.get(key) ?? {until:now+60000,count:0};
    if(hits.size>=10000 && !hits.has(key)) {reply(429,{error:'rate_limited'});return true;}
    hit.count++;hits.set(key,hit);
    if(hit.count>(limits[route] ?? 60)) {reply(429,{error:'rate_limited'});return true;}
    try {
      const result=route==='me'? await auth.me(req.headers.authorization): await auth[route](await readJsonBody(req));
      reply(route==='signup'?201:route==='logout'?204:200,result);
    } catch(error) {
      if(!(error instanceof AuthError)) throw error;
      reply(error.status,{error:error.code});
    }
    return true;
  };
}
