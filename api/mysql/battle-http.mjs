import {AuthError} from '../server/auth.mjs';
import {readJsonBody} from '../server/auth-http.mjs';
export function battleRoutes(service){const hits=new Map();return async(req,path,send)=>{
 if(path!=='/match'&&!path.startsWith('/battles'))return false;
 const reply=(status,body)=>send(status,body,{'Cache-Control':'no-store'}),time=Date.now(),key=req.socket.remoteAddress;
 for(const[k,v]of hits)if(v.until<=time)hits.delete(k);const hit=hits.get(key)??{n:0,until:time+60000};if((hits.size>=10000&&!hits.has(key))||++hit.n>600){reply(429,{error:'rate_limited'});return true;}hits.set(key,hit);
 try{const m=req.method,h=req.headers.authorization,item=/^\/battles\/([0-9a-f-]+)(?:\/(answers|result|overtime|forfeit|study-skip))?$/.exec(path);
  if(path==='/match'&&m==='POST')reply(200,await service.join(h,await readJsonBody(req)));
  else if(path==='/match'&&m==='GET')reply(200,await service.match(h));
  else if(path==='/match'&&m==='DELETE')reply(200,await service.leave(h,await readJsonBody(req)));
  else if(path==='/battles/inbox'&&m==='GET')reply(200,await service.inbox(h));
  else if(path==='/battles/history'&&m==='GET')reply(200,await service.history(h));
  else if(item&&!item[2]&&m==='GET')reply(200,await service.get(h,item[1]));
  else if(item&&m==='POST'){
   if(item[2]==='study-skip')reply(200,await service.studySkip(h,item[1],await readJsonBody(req)));
   else if(item[2]==='answers')reply(200,await service.answer(h,item[1],await readJsonBody(req)));
   else if(item[2]==='overtime')reply(200,await service.overtime(h,item[1],await readJsonBody(req)));
   else if(item[2]==='result')reply(200,await service.submit(h,item[1]));
   else if(item[2]==='forfeit')reply(200,await service.forfeit(h,item[1]));
   else reply(405,{error:'method_not_allowed'});
  }else reply(405,{error:'method_not_allowed'});
 }catch(e){if(!(e instanceof AuthError))throw e;reply(e.status,{error:e.code});}return true;
};}
