import {AuthError} from '../server/auth.mjs';
import {readJsonBody} from '../server/auth-http.mjs';
export function speedRoutes(service){const hits=new Map();return async(req,path,send)=>{
 if(!path.startsWith('/me/speed/'))return false;
 const reply=(n,b)=>send(n,b,{'Cache-Control':'no-store'});
 const now=Date.now(),key=req.socket.remoteAddress;for(const[k,v]of hits)if(v.until<=now)hits.delete(k);const hit=hits.get(key)??{until:now+60000,n:0};
 if((hits.size>=10000&&!hits.has(key))||++hit.n>1200){reply(429,{error:'rate_limited'});return true;}hits.set(key,hit);
 try{const header=req.headers.authorization,m=req.method,match=/^\/me\/speed\/runs\/([0-9a-f-]+)\/(answers|finish)$/.exec(path);
  if(path==='/me/speed/stats'&&m==='GET')reply(200,await service.stats(header));
  else if(path==='/me/speed/runs'&&m==='POST')reply(200,await service.start(header,await readJsonBody(req)));
  else if(match&&m==='POST')reply(200,match[2]==='answers'?await service.answer(header,match[1],await readJsonBody(req)):await service.finish(header,match[1]));
  else reply(405,{error:'method_not_allowed'});
 }catch(e){if(!(e instanceof AuthError))throw e;reply(e.status,{error:e.code});}return true;
};}
