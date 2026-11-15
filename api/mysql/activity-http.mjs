import {AuthError} from '../server/auth.mjs';
import {rateKey} from '../server/client-key.mjs';
import {readJsonBody} from '../server/auth-http.mjs';
export function activityRoutes(service){const hits=new Map();return async(req,path,send)=>{
 if(path!=='/me/rewards'&&path!=='/me/activities'&&!path.startsWith('/me/activities/'))return false;
 const reply=(s,v)=>send(s,v,{'Cache-Control':'no-store'}),at=Date.now(),key=rateKey(req);
 for(const [k,v]of hits)if(v.until<=at)hits.delete(k);
 const h=hits.get(key)??{n:0,until:at+60000};if((hits.size>=10000&&!hits.has(key))||++h.n>240){reply(429,{error:'rate_limited'});return true;}hits.set(key,h);
 try{
  const header=req.headers.authorization,match=/^\/me\/activities\/([0-9a-f-]+)(?:\/(events|answers|complete|abandon))?$/.exec(path);
  if(path==='/me/rewards'&&req.method==='GET')reply(200,await service.status(header));
  else if(path==='/me/activities'&&req.method==='POST')reply(200,await service.issue(header,await readJsonBody(req)));
  else if(match&&req.method==='GET'&&!match[2])reply(200,await service.get(header,match[1]));
  else if(match&&req.method==='POST'&&match[2]){
   const body=await readJsonBody(req);const name={events:'event',answers:'answer',complete:'complete',abandon:'abandon'}[match[2]];reply(200,await service[name](header,match[1],body));
  }else reply(405,{error:'method_not_allowed'});
 }catch(e){if(!(e instanceof AuthError))throw e;reply(e.status,{error:e.code});}return true;
};}
