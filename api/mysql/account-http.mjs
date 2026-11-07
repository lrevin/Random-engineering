import { AuthError } from '../server/auth.mjs';
import { readJsonBody } from '../server/auth-http.mjs';
export function accountRoutes(service) {
  const hits=new Map();
  return async(req,pathname,send)=>{
    if(!['/me/profile','/me','/auth/cancel-deletion'].includes(pathname)) return false;
    const reply=(status,value)=>send(status,value,{'Cache-Control':'no-store','Pragma':'no-cache'});
    const method=req.method;
    if(!(pathname==='/me/profile'&&['GET','PUT'].includes(method) || pathname==='/me'&&method==='DELETE' || pathname==='/auth/cancel-deletion'&&method==='POST')) {
      reply(405,{error:'method_not_allowed'});return true;
    }
    const now=Date.now();for(const [key,h] of hits)if(h.until<=now)hits.delete(key);
    const key=`${req.socket.remoteAddress}:${pathname}:${method}`,hit=hits.get(key)??{until:now+60000,n:0};
    if(hits.size>=10000&&!hits.has(key)){reply(429,{error:'rate_limited'});return true;}
    hits.set(key,hit);hit.n++;
    if(hit.n>(pathname==='/me/profile'?120:10)){reply(429,{error:'rate_limited'});return true;}
    try {
      if(pathname==='/me/profile') reply(200,method==='GET'?await service.getProfile(req.headers.authorization):await service.saveProfile(req.headers.authorization,await readJsonBody(req)));
      else if(pathname==='/me') reply(202,await service.requestDeletion(req.headers.authorization));
      else reply(200,await service.cancelDeletion(await readJsonBody(req)));
    } catch(error) {
      if(!(error instanceof AuthError))throw error;
      reply(error.status,{error:error.code});
    }
    return true;
  };
}