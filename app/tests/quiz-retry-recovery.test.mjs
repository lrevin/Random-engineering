import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(new URL('../package.json',import.meta.url))('typescript');
const element=(type,props)=>({type,props});
const walk=x=>!x||typeof x!=='object'?[]:[x,...Object.values(x.props??{}).flatMap(v=>Array.isArray(v)?v.flatMap(walk):walk(v))];
const tick=()=>new Promise(r=>setImmediate(r));
function harness(screen,initial,api={}){
 let active=initial,cursor=0,slots=[],effects=[],cleanups=[],serial=0;const routes=[];
 class AuthApiError extends Error{constructor(code,status){super(code);this.status=status;}}
 const hooks={useState(init){const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},useRef(init){const i=cursor++;return slots[i]??(slots[i]={current:init});},useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,n)=>v!==old[n])){slots[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=fn();});}}};
 const setActive=v=>{active=typeof v==='function'?v(active):v;};
 const topic={id:'arch-19',ko:'주제',domain:'domain'};
 const deps={
  'react':hooks,'react/jsx-runtime':{jsx:element,jsxs:element},'react-native':{View:'View',ActivityIndicator:'Spinner',Platform:{OS:'android'},Pressable:'Pressable',ScrollView:'ScrollView'},
  'expo-router':{Redirect:'Redirect',router:{replace:p=>routes.push(p),push:p=>routes.push(p)}},'expo-crypto':{randomUUID:()=>`new-id-${++serial}`},'expo-haptics':{},
  'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},'@/lib/app-state':{useApp:()=>({mode:'user',active,setActive,records:[],xp:0,keptDays:[],addRecord:api.addRecord})},
  '@/components/ui':{Btn:'Btn',Card:'Card',Row:'Row',Screen:'Screen',T:'T',Badge:'Badge',levelTone:()=>''},'@/components/Rank':{LevelBadge:'LevelBadge',TierBadge:'TierBadge',UserLevelBar:'UserLevelBar'},
  '@/components/Icon':{Icon:'Icon'},'@/components/RankUp':{RankUp:'RankUp'},'@/data':{levelText:()=>'',topicById:()=>topic,domainById:()=>({name:'분야'})},
  '@/theme':{useColors:()=>({}),screenBg:()=>({})},'@/lib/rank':{calcRp:()=>({total:20,parts:[]}),userLevel:()=>({level:1}),domainMastery:()=>({points:0,topics:0,index:0,next:null}),TIERS:[{name:'시작'}],DOMAIN_TIER_MIN:[0]},
  '@/lib/auth':{mysqlAuth:api,authErrorMessage:e=>e.message,isConnectionFailure:e=>e instanceof TypeError},'@/lib/auth-client':{AuthApiError},'@/lib/confirm':{confirmQuit:f=>f()},'@/lib/quiz':{loadOfflineQuiz:async()=>({source:'bank',questions:[{type:'ox',q:'내장 문제',answer:true,explain:'해설',src:'bank'}]})},'@/lib/booster':{boostActive:()=>false},'@/lib/sfx':{},'@/lib/stats':{calcStreak:()=>({today:false,streak:0})},
 };
 const source=fs.readFileSync(new URL('../src/app/'+screen+'.tsx',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};new Function('exports','require',code)(exports,key=>{assert(Object.hasOwn(deps,key),key);return deps[key];});
 return {get active(){return active;},routes,render(){cursor=0;const outer=exports.default();const tree=typeof outer.type==='function'?outer.type(outer.props):outer;for(const fn of effects.splice(0))fn();return tree;},unmount(){for(const fn of cleanups)fn?.();}};
}
const result=()=>({topicId:'arch-19',stage:'result',memo:'메모',studyTotal:900,studyLeft:0,studyUsed:900,quizOnly:false,startedAt:'old',endAt:null,serverAttemptId:'completed-id',serverTracking:true,serverPendingEvent:{event:'quiz',id:'old-event'},quiz:{source:'ai',questions:[],answers:[]},result:{score:7,total:7,rp:20,parts:[],streak:1,userLevelBefore:1,userLevelAfter:1,topicTierBefore:0,topicTierAfter:0}});
test('결과 화면 재풀이는 완료 ID·대기 요청·학습 시간·답안을 상속하지 않는다',()=>{
 const old=result(),h=harness('result',old),tree=h.render();walk(tree).find(x=>x.props?.title==='퀴즈 다시 풀기').props.onPress();
 assert.equal(h.active.topicId,old.topicId);assert.equal(h.active.memo,old.memo);assert.equal(h.active.stage,'quiz');assert.equal(h.active.quizOnly,true);
 for(const field of ['serverAttemptId','serverTracking','serverPendingEvent'])assert.equal(h.active[field],undefined);
 assert.equal(h.active.studyUsed,0);assert.equal(h.active.studyTotal,0);assert.equal(h.active.quiz,null);assert.equal(h.active.result,null);assert.equal(old.stage,'result');assert.deepEqual(h.routes,['/quiz']);
});
test('기존 완료 ID를 물려받은 재풀이도 새 서버 ID로 복구한다',async()=>{
 const calls=[],h=harness('quiz',{...result(),stage:'quiz',quizOnly:true,quiz:null},{getActivity:async()=>({status:'completed'}),issueActivity:async x=>calls.push(x),activityEvent:async id=>({items:[{question:{type:'ox',q:'문제',answer:true,explain:'해설',src:'bank'}}]})});
 h.render();await tick();assert.equal(calls.length,1);assert.notEqual(calls[0].requestId,'completed-id');assert.equal(calls[0].studySec,0);assert.equal(h.active.quiz.questions.length,1);
});
test('로딩 중 중단은 늦은 발급 완료 후 서버를 중단하고 상태를 되살리지 않는다',async()=>{
 let resolveIssue;const issued=new Promise(r=>resolveIssue=r),calls=[];
 const h=harness('quiz',{...result(),stage:'quiz',quizOnly:true,quiz:null,serverAttemptId:undefined,serverTracking:undefined},{issueActivity:()=>issued,activityEvent:async()=>{throw Error('중단 후 출제 금지');},abandonActivity:async id=>calls.push(id)});
 const tree=h.render();walk(tree).find(x=>x.props?.title==='그만두고 홈으로').props.onPress();await tick();assert.equal(calls.length,0);resolveIssue();await tick();
 assert.equal(calls.length,1);assert.equal(h.active,null);assert.deepEqual(h.routes,['/home']);
});

 test('통신 실패 후 다시 시도는 같은 서버 ID로 실제 요청을 재실행한다',async()=>{
 const ids=[];let attempts=0;
 const h=harness('quiz',{...result(),stage:'quiz',quizOnly:true,quiz:null,serverAttemptId:undefined,serverTracking:undefined},{issueActivity:async x=>{ids.push(x.requestId);if(++attempts===1)throw Error('통신 실패');},activityEvent:async()=>({items:[{question:{type:'ox',q:'문제',answer:true,explain:'해설',src:'bank'}}]})});
 h.render();await tick();const tree=h.render();walk(tree).find(x=>x.props?.title==='다시 시도').props.onPress();h.render();await tick();
 assert.equal(ids.length,2);assert.equal(ids[0],ids[1]);assert.equal(h.active.quiz.questions.length,1);
 });
 test('서버 중단 실패 시 기기 진행 상태를 지우지 않는다',async()=>{
 const h=harness('quiz',{...result(),stage:'quiz',quizOnly:true,quiz:null,serverAttemptId:undefined,serverTracking:undefined},{issueActivity:async()=>{},activityEvent:async()=>({items:[{question:{type:'ox',q:'문제',answer:true,explain:'해설',src:'bank'}}]}),abandonActivity:async()=>{throw Error('통신 실패');}});
 const tree=h.render();walk(tree).find(x=>x.props?.title==='그만두고 홈으로').props.onPress();await tick();assert(h.active);assert.deepEqual(h.routes,[]);
 });

test('재풀이 서버 연결 실패 후 내장 문제 선택은 새 ID로 보관하고 서버 ID를 상속하지 않는다',async()=>{
 const h=harness('quiz',{...result(),stage:'quiz',quizOnly:true,quiz:null,serverAttemptId:undefined,serverTracking:undefined},{issueActivity:async()=>{throw new TypeError('offline');}});
 h.render();await tick();const tree=h.render();
 walk(tree).find(x=>x.props?.title==='내장 문제로 오프라인 풀이').props.onPress();
 h.render();await tick();
 assert.equal(h.active.offlineStudy,true);assert.equal(h.active.serverAttemptId,undefined);assert.equal(h.active.serverTracking,false);assert.ok(h.active.localRecordId);assert.equal(h.active.quiz.questions[0].q,'내장 문제');
 const restored=harness('quiz',JSON.parse(JSON.stringify(h.active)),{issueActivity:async()=>{throw Error('복원 시 재발급 금지');}});
 restored.render();await tick();assert.deepEqual(restored.active.quiz,h.active.quiz);assert.equal(restored.active.localRecordId,h.active.localRecordId);
});

test('서버 발급 후 오프라인 완료도 원래 ID와 답안을 보존하고 0 XP 대기 결과로 이동',async()=>{
 const submitted=[];const q={type:'ox',q:'문제',answer:true,explain:'해설',src:'ai'};
 const h=harness('quiz',{...result(),stage:'quiz',quiz:{source:'ai',questions:Array(7).fill(q),answers:Array(6).fill(true)}},{addRecord:async r=>{submitted.push(r);return {...r,id:r.attemptId,rp:0,xpParts:[],synced:false};}});
 const tree=h.render();tree.props.onNext(true);tree.props.onNext(true);await tick();
 assert.equal(submitted.length,1);assert.equal(submitted[0].attemptId,'completed-id');assert.equal(submitted[0].items.length,7);assert(submitted[0].items.every(i=>i.answer===true));
 assert.equal(h.active.stage,'result');assert.equal(h.active.result.rp,0);assert.deepEqual(h.routes,['/result']);
});
test('완료 저장 실패 후 재시도는 같은 로컬 ID와 답안을 사용',async()=>{
 const ids=[];let fail=true;const q={type:'ox',q:'내장 문제',answer:true,explain:'해설',src:'bank'};
 const h=harness('quiz',{...result(),stage:'quiz',serverAttemptId:undefined,serverTracking:false,offlineStudy:true,quiz:{source:'bank',questions:Array(7).fill(q),answers:Array(6).fill(true)}},{addRecord:async r=>{ids.push(r.attemptId);if(fail)throw Error('저장 공간 부족');return {...r,id:r.attemptId,rp:0,xpParts:[],synced:false};}});
 h.render().props.onNext(true);await tick();assert.equal(h.active.stage,'quiz');assert.equal(h.active.quiz.answers.length,7);assert.deepEqual(h.routes,[]);
 fail=false;h.render().props.onNext(true);await tick();assert.equal(ids.length,2);assert.equal(ids[0],ids[1]);assert.equal(h.active.stage,'result');
});

test('오프라인 내장 풀이를 그만두면 서버 취소 응답 없이 홈으로 나갈 수 있다',async()=>{
 let calls=0;
 const h=harness('quiz',{...result(),stage:'quiz',quizOnly:true,quiz:null,offlineStudy:true,serverAttemptId:undefined,serverTracking:false},{abandonActivity:async()=>{calls++;throw new TypeError('offline');}});
 const tree=h.render();walk(tree).find(x=>x.props?.title==='그만두고 홈으로').props.onPress();await tick();assert.equal(calls,0);assert.equal(h.active,null);assert.deepEqual(h.routes,['/home']);
});
