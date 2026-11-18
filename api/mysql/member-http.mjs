import {AuthError} from '../server/auth.mjs';
import { rateKey, overLimit } from '../server/client-key.mjs';
import {readJsonBody} from '../server/auth-http.mjs';
export function memberRoutes(service){const hits=new Map();return async(req,path,send)=>{
 if(!path.startsWith('/social/')&&!path.startsWith('/me/wallet')&&path!=='/me/push-token')return false;
 const reply=(n,b)=>send(n,b,{'Cache-Control':'no-store'});
 const now=Date.now(),key=rateKey(req);
 if(overLimit(hits,key,240,now)){reply(429,{error:'rate_limited'});return true;}
 try{
  const h=req.headers.authorization,m=req.method;
  if(path==='/social/me'&&m==='POST')reply(200,await service.me(h));
  else if(path==='/social/friends'&&m==='GET')reply(200,await service.friends(h));
  else if(path==='/social/friends/requests'&&m==='POST')reply(200,await service.friend(h,String((await readJsonBody(req)).uid??'').toUpperCase(),'request'));
  else if(/^\/social\/friends\/requests\/[A-Z2-9]{8}\/(accept|decline)$/.test(path)&&m==='POST'){const p=path.split('/');reply(200,await service.friend(h,p[4],p[5]));}
  else if(/^\/social\/friends\/[A-Z2-9]{8}$/.test(path)&&m==='GET')reply(200,await service.friendInfo(h,path.split('/')[3]));
  else if(/^\/social\/friends\/[A-Z2-9]{8}\/poke$/.test(path)&&m==='POST')reply(200,await service.poke(h,path.split('/')[3]));
  else if(path==='/me/push-token'&&(m==='POST'||m==='DELETE'))reply(200,await service.pushToken(h,await readJsonBody(req),m==='DELETE'));
  else if(/^\/social\/friends\/[A-Z2-9]{8}$/.test(path)&&m==='DELETE')reply(200,await service.friend(h,path.split('/')[3],'remove'));
  else if(path==='/me/wallet'&&m==='GET')reply(200,await service.wallet(h));
  else if(path==='/me/wallet/operations'&&m==='POST')reply(200,await service.operate(h,await readJsonBody(req)));
  else reply(405,{error:'method_not_allowed'});
 }catch(e){if(!(e instanceof AuthError))throw e;reply(e.status,{error:e.code});}return true;
};}
