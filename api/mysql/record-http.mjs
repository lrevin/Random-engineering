import { AuthError } from '../server/auth.mjs';
import { readJsonBody } from '../server/auth-http.mjs';
export function recordRoutes(service){
 const hits=new Map();
 return async(req,pathname,send)=>{
  if(pathname!=='/me/stats'&&!pathname.startsWith('/me/records'))return false;
  const reply=(status,data)=>send(status,data,{'Cache-Control':'no-store'});
  const now=Date.now(),key=req.socket.remoteAddress;for(const[k,v]of hits)if(v.until<=now)hits.delete(k);
  const hit=hits.get(key)??{until:now+60000,n:0};if(hits.size>=10000&&!hits.has(key)){reply(429,{error:'rate_limited'});return true;}hits.set(key,hit);if(++hit.n>240){reply(429,{error:'rate_limited'});return true;}
  try{
   const url=new URL(req.url,'http://local'),header=req.headers.authorization,method=req.method;
   const item=/^\/me\/records\/([0-9a-f-]+)(\/memo)?$/.exec(pathname);
   if(pathname==='/me/records'&&method==='PUT')reply(200,await service.upload(header,await readJsonBody(req,{maxBytes:4*1024*1024})));
   else if(pathname==='/me/records'&&method==='GET')reply(200,await service.list(header,url.searchParams));
   else if(pathname==='/me/records/snapshot'&&method==='GET')reply(200,await service.snapshot(header));
   else if(pathname==='/me/records/changes'&&method==='GET')reply(200,await service.changes(header,url.searchParams));
   else if(pathname==='/me/stats'&&method==='GET')reply(200,await service.stats(header));
   else if(item&&item[2]&&method==='PUT')reply(200,await service.memo(header,item[1],await readJsonBody(req)));
   else if(item&&!item[2]&&method==='GET')reply(200,await service.get(header,item[1]));
   else if(item&&!item[2]&&method==='DELETE'){await service.remove(header,item[1]);reply(204);}
   else reply(405,{error:'method_not_allowed'});
  }catch(e){if(!(e instanceof AuthError))throw e;reply(e.status,{error:e.code,...(e.details??{})});}
  return true;
 };
}