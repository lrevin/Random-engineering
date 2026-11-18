import {AuthError} from './auth.mjs';
// 이전 앱의 직접 AI 요청은 서버 발급 학습으로 통합한다. 이 경로에서 LLM을 재호출하지 않는다.
export const QUIZ_DAILY_LIMIT=30,QUIZ_FRESH_DAILY_LIMIT=10;
export function quizProxyRoutes(auth){
 return async(req,pathname,send)=>{
  if(pathname!=='/me/quiz')return false;
  const reply=(status,body)=>send(status,body,{'Cache-Control':'no-store'});
  if(req.method!=='POST'){reply(405,{error:'method_not_allowed'});return true;}
  try{await auth.me(req.headers.authorization);reply(409,{error:'quiz_activity_required'});}
  catch(e){if(!(e instanceof AuthError))throw e;reply(e.status,{error:e.code});}return true;
 };
}
