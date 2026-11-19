// 실제 연결 확인은 운영 적용 단계에서 명시적으로 실행한다. 토큰 값은 출력하지 않는다.
import {llmFetch} from './llm-http.mjs';
import {llmSettings,readLimitedJson} from './quiz-job-service.mjs';
try{
 const settings=llmSettings(),response=await llmFetch(settings.url+'/health',{signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw Error('health_failed');const data=await readLimitedJson(response,16384);
 if(data?.ok!==true)throw Error('health_failed');
 console.log(JSON.stringify({ok:true,model:typeof data.model==='string'?data.model.slice(0,100):null,reviewer:typeof data.reviewer==='string'?data.reviewer.slice(0,100):null,busy:data.busy===true,tokenConfigured:!!settings.token,newQuestionStatus:settings.newQuestionStatus}));
}catch{console.error('LLM 상태 확인 실패: 터널·서버 주소를 확인하세요.');process.exitCode=1;}
