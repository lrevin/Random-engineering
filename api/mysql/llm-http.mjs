// 실제 터널 요청: 연결 5초, 전체 기한은 호출자의 AbortSignal. 긴 생성 중에는 유휴 타임아웃을 걸지 않는다.
import http from 'node:http';
import https from 'node:https';
export function llmFetch(input,{method='GET',headers={},body,signal,connectTimeoutMs=5000,maxBytes=131072}={}){
 return new Promise((resolve,reject)=>{
  const url=new URL(input);if(!['http:','https:'].includes(url.protocol)){reject(Error('invalid_llm_protocol'));return;}
  let timer,settled=false;
  const fail=error=>{if(settled)return;settled=true;clearTimeout(timer);reject(error);};
  const req=(url.protocol==='https:'?https:http).request(url,{method,headers,signal,agent:false},res=>{
   clearTimeout(timer);let size=0;const chunks=[];
   const tooLarge=()=>{const error=Object.assign(Error('LLM response too large'),{code:'LLM_RESPONSE_TOO_LARGE'});fail(error);res.destroy();req.destroy();};
   if(Number(res.headers['content-length']||0)>maxBytes){tooLarge();return;}
   res.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){tooLarge();return;}chunks.push(chunk);});
   res.on('error',fail);res.on('aborted',()=>fail(Object.assign(Error('LLM response interrupted'),{code:'LLM_RESPONSE_INTERRUPTED'})));
   res.on('end',()=>{if(settled)return;try{const status=res.statusCode??502,response=new Response([204,205,304].includes(status)?null:Buffer.concat(chunks),{status,headers:res.headers['content-type']?{'content-type':res.headers['content-type']}:{}});settled=true;resolve(response);}catch(e){fail(e);}});
  });
  timer=setTimeout(()=>{const error=Object.assign(Error('LLM connection timed out'),{code:'LLM_CONNECT_TIMEOUT'});fail(error);req.destroy();},connectTimeoutMs);timer.unref?.();
  req.on('socket',socket=>{if(url.protocol==='https:')socket.once('secureConnect',()=>clearTimeout(timer));else if(socket.connecting)socket.once('connect',()=>clearTimeout(timer));else clearTimeout(timer);});
  req.on('error',fail);req.end(body);
 });
}
