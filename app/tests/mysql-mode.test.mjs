import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(new URL('../package.json',import.meta.url))('typescript');
function load(name,deps={},env={}) {
 const source=fs.readFileSync(new URL('../src/lib/'+name+(name==='app-state'?'.tsx':'.ts'),import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};
 new Function('exports','require','process',code)(exports,key=>{
  assert.ok(Object.hasOwn(deps,key),`Unexpected dependency: ${key}`);return deps[key];
 },{env});return exports;
}
const authClient=load('auth-client');
const {createAuthClient,AuthApiError}=authClient;
function store(initial=null){let raw=initial;return {read:async()=>raw,write:async v=>{raw=v;},remove:async()=>{raw=null;}};}
const session={accessToken:'access',refreshToken:'refresh',expiresIn:900,user:{id:'user-1',email:'tester@example.com'}};
const response=(value,status=200)=>new Response(status===204?null:JSON.stringify(value),{status});

test('API URL is required; obsolete provider variables cannot select another backend',()=>{
 for(const provider of [undefined,'supabase','typo']) {
  const calls=[];
  const mod=load('auth',{'./api':{API_URL:'https://api.example.com'},'./auth-client':{...authClient,createAuthClient:(...a)=>{calls.push(a);return {}; }},'./auth-storage':{authStorage:{}}},{EXPO_PUBLIC_AUTH_PROVIDER:provider});
  assert.ok(mod.mysqlAuth);assert.equal(calls.length,1);assert.equal(calls[0][0],'https://api.example.com');
 }
 assert.throws(()=>load('auth',{'./api':{API_URL:''},'./auth-client':authClient,'./auth-storage':{authStorage:{}}}),/required/);
});
test('authentication error messages retain useful network and account feedback',()=>{
 const {authErrorMessage}=load('auth',{'./api':{API_URL:'https://api.example.com'},'./auth-client':authClient,'./auth-storage':{authStorage:store()}});
 assert.match(authErrorMessage(new AuthApiError('invalid_credentials',401)),/이메일/);
 assert.match(authErrorMessage(new TypeError('fetch failed')),/인터넷/);
 assert.equal(typeof authErrorMessage(null),'string');
});
test('signup, authenticated profile save, persisted login restoration and logout',async()=>{
 const storage=store(),calls=[];
 const fetcher=async(url,init)=>{
  calls.push([new URL(url).pathname,init]);
  if(url.endsWith('/auth/signup')) return response(session);
  if(url.endsWith('/auth/me')) return response({user:session.user});
  if(url.endsWith('/me/profile')) return response({profile:JSON.parse(init.body)});
  if(url.endsWith('/auth/logout'))return response(null,204);
  throw new Error('unexpected route');
 };
 const client=createAuthClient('https://api.example.com',storage,fetcher);
 await client.signUp('tester@example.com','Password!1');
 const profile={nickname:'tester',interests:['ds'],level:1,studyMinutes:15,reminderEnabled:true,reminderTime:'21:00'};
 assert.deepEqual(await client.saveProfile(profile),profile);
 assert.equal(calls.at(-1)[1].headers.Authorization,'Bearer access');
 const restored=createAuthClient('https://api.example.com',storage,fetcher);
 assert.equal((await restored.restore()).user.id,'user-1');
 await restored.signOut();assert.equal(await storage.read(),null);
});
test('authenticated polling does not preflight auth/me for every request',async()=>{
 let me=0,api=0;const storage=store();
 const client=createAuthClient('https://api.example.com',storage,async(url)=>{
  if(url.endsWith('/auth/signup'))return response(session);
  if(url.endsWith('/auth/me')){me++;return response({user:session.user});}
  if(url.endsWith('/battles/example')){api++;return response({ok:true});}
  throw new Error('unexpected');
 });
 await client.signUp('tester@example.com','Password!1');
 await Promise.all(Array.from({length:150},()=>client.apiRequest('/battles/example')));
 assert.equal(api,150);assert.equal(me,0);
 await client.ensure();assert.equal(me,1); // Explicit account/session checks are retained.
});

test('offline session restoration preserves login; offline logout still clears it',async()=>{
 const storage=store(JSON.stringify({...session,expiresAt:Date.now()+900000}));
 const client=createAuthClient('https://api.example.com',storage,async()=>{throw new TypeError('offline');});
 assert.equal((await client.restore()).user.id,'user-1');
 await assert.rejects(client.signOut(),{code:'network_error'});assert.equal(await storage.read(),null);
});
test('concurrent session refreshes share one request and persist rotated token',async()=>{
 let calls=0;const storage=store(JSON.stringify({...session,expiresAt:0}));
 const client=createAuthClient('https://api.example.com',storage,async()=>{calls++;return response({...session,refreshToken:'rotated'});});
 await client.restore();calls=0;
 await Promise.all([client.refresh(),client.refresh()]);assert.equal(calls,1);
 assert.equal(JSON.parse(await storage.read()).refreshToken,'rotated');
});
test('rejected refresh clears login credentials',async()=>{
 const storage=store(JSON.stringify({...session,expiresAt:0}));
 const client=createAuthClient('https://api.example.com',storage,async()=>response({error:'unauthorized'},401));
 assert.equal(await client.restore(),null);assert.equal(await storage.read(),null);
});
const q={type:'ox',q:'테스트다.',answer:true,explain:'테스트입니다.'};
function quiz(fetchBankQuestions,cache=new Map(),bundled=[{...q,q:'내장 문제다.'}],full=false) {
 return load('quiz',{
  '@react-native-async-storage/async-storage':{__esModule:true,default:{getItem:async key=>cache.get(key)??null,setItem:async(key,value)=>cache.set(key,value)}},
  '@/data':{TOPICS:[]},'@/data/quizbank':{QUIZ_BANK:{'ds-01':bundled},BANK_BUNDLED_FULL:full},'./api':{fetchBankQuestions},
 });
}
test('full bundled bank works without network and ignores old domain downloads',async()=>{
 const cache=new Map([['pg.mysql.downloads.v1','old'],['pg.mysql.bank.ds-01',JSON.stringify({at:Date.now(),qs:[q]})]]);
 const mod=quiz(async()=>{throw Error('must not fetch');},cache,undefined,true);
 assert.equal((await mod.bankQuestions('ds-01'))[0].q,'내장 문제다.');
 assert.deepEqual(await mod.bankQuestions('missing'),[]);
});

test('basic question API is preferred and MySQL cache key remains compatible',async()=>{
 let calls=0;const cache=new Map(),mod=quiz(async()=>{calls++;return [q];},cache);
 assert.deepEqual(await mod.bankQuestions('ds-01'),[q]);assert.deepEqual(await mod.bankQuestions('ds-01'),[q]);
 assert.equal(calls,1);assert.ok(cache.has('pg.mysql.bank.ds-01'));
});
test('expired cache survives network failure; missing cache uses bundled questions',async()=>{
 const cache=new Map([['pg.mysql.bank.ds-01',JSON.stringify({at:0,qs:[q]})]]);
 assert.deepEqual(await quiz(async()=>{throw Error('offline');},cache).bankQuestions('ds-01'),[q]);
 assert.equal((await quiz(async()=>{throw Error('offline');}).bankQuestions('ds-01'))[0].q,'내장 문제다.');
});
test('successful empty question bank is not replaced with stale/bundled data',async()=>{
 assert.deepEqual(await quiz(async()=>[]).bankQuestions('ds-01'),[]);
});
test('quiz remains seven questions when no AI server is configured',async()=>{
 const bank=Array.from({length:7},(_,i)=>({...q,q:`문제 ${i}다.`}));
 const result=await quiz(async()=>bank,new Map(),bank,true).loadQuiz({id:'ds-01'});
 assert.equal(result.questions.length,7);assert.equal(result.source,'bank');
 assert.equal(new Set(result.questions.map(q=>q.q)).size,7);
});
const {syncMySqlRecords,enqueueRecordOperation}=load('record-sync',{'./auth-client':authClient});
test('failed record upload retains the same pending UUID for retry',async()=>{
 let records=[{id:'fixed-uuid',synced:false,memo:'',studiedAt:'2026-11-13T00:00:00Z'}];const sent=[];
 const client={uploadRecords:async rs=>{sent.push(rs[0].id);throw new AuthApiError('network_error');}};
 for(let i=0;i<2;i++)await assert.rejects(syncMySqlRecords(client,()=>records,r=>{records=r;},()=>true,async()=>{}));
 assert.deepEqual(sent,['fixed-uuid','fixed-uuid']);assert.equal(records[0].synced,false);
});
test('in-flight upload response cannot overwrite a switched account',async()=>{
 let current=true,records=[{id:'a',synced:false}],writes=0;
 await syncMySqlRecords({uploadRecords:async()=>{current=false;records=[{id:'b',synced:false}];return {results:[{id:'a',ok:true,record:{id:'a',synced:true}}]};}},()=>records,()=>{writes++;},()=>current,async()=>{});
 assert.equal(writes,0);assert.equal(records[0].id,'b');
});
test('memo conflict preserves local draft and server alternative',async()=>{
 const remote={id:'a',synced:true,memo:'old',changeSeq:'1',studiedAt:'2026-11-13T00:00:00Z'};
 let records=[{...remote,memo:'draft',memoPending:{version:'v',baseChangeSeq:'1'}}];
 await syncMySqlRecords({recordSnapshot:async()=>({records:[remote],cursor:'1'}),saveRecordMemo:async()=>{throw new AuthApiError('memo_conflict',409,{record:{...remote,memo:'server',changeSeq:'2'}});}},()=>records,r=>{records=r;},()=>true,async()=>{});
 assert.equal(records[0].memo,'draft');assert.equal(records[0].memoConflict.memo,'server');
});
test('record queue serializes deletes and reads even after previous failures',async()=>{
 const queue={current:Promise.resolve()},steps=[];
 const first=enqueueRecordOperation(queue,async()=>{steps.push('delete');throw Error('offline');});
 const second=enqueueRecordOperation(queue,async()=>{steps.push('snapshot');});
 await assert.rejects(first);await second;assert.deepEqual(steps,['delete','snapshot']);
});

// Execute the real AppProvider callbacks with in-memory storage and a small hook runner.
// Network calls are mocked; native rendering and React scheduling are verified separately on devices.
function stateHarness() {
 const values=[],cache=new Map(),profiles=new Map(),records=new Map();let slot=0,user='a',id=0;
 const storage={
  getItem:async k=>cache.get(k)??null,setItem:async(k,v)=>{cache.set(k,v);},
  removeItem:async k=>cache.delete(k),
  multiGet:async keys=>keys.map(k=>[k,cache.get(k)??null]),
  multiSet:async pairs=>{for(const [k,v]of pairs)cache.set(k,v);},
  multiRemove:async keys=>{for(const k of keys)cache.delete(k);},getAllKeys:async()=>[...cache.keys()],
 };
 const auth={
  signIn:async email=>{user=email;return {user:{id:user,email}};},
  signUp:async email=>{user=email;return {user:{id:user,email}};},
  signOut:async()=>{},deleteAccount:async()=>{records.delete(user);profiles.delete(user);},
  getProfile:async()=>profiles.get(user)??null,
  saveProfile:async p=>{profiles.set(user,p);return p;},
  uploadRecords:async rs=>{const saved=records.get(user)??[];const results=rs.map(r=>({id:r.id,ok:true,record:{...r,synced:true,changeSeq:'1'}}));records.set(user,[...saved,...results.map(x=>x.record)]);return {results};},
  recordSnapshot:async()=>({records:records.get(user)??[],cursor:'1'}),
  deleteRecord:async target=>{records.set(user,(records.get(user)??[]).filter(r=>r.id!==target));},
 };
 const hooks={createContext:()=>({Provider:'provider'}),useContext:()=>null,
  useState:initial=>{const i=slot++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return [values[i],v=>{values[i]=typeof v==='function'?v(values[i]):v;}];},
  useRef:initial=>{const i=slot++;if(!(i in values))values[i]={current:initial};return values[i];},
  useCallback:fn=>fn,useMemo:fn=>fn(),useLayoutEffect:fn=>fn(),useEffect:()=>{},
 };
 const mod=load('app-state',{
  '@react-native-async-storage/async-storage':{__esModule:true,default:storage},'expo-crypto':{randomUUID:()=>`record-${++id}`,getRandomBytes:n=>new Uint8Array(n)},
  '@/data':{topicById:id=>({id,ko:'테스트',domain:'it',category:'ds',level:'기초'})},
  './catalog-sync':{subscribeCatalog:()=>()=>{},catalogRevision:()=>0},
  react:{...hooks,useSyncExternalStore:(_subscribe,snapshot)=>snapshot()},'react/jsx-runtime':{jsx:(_type,props)=>props},'react-native':{AppState:{}},
  './economy':{refillTickets:()=>({n:3,bought:0}),MAX_FREEZES:3,monthKey:()=> '2026-11'},
  './ads':{AD_DAILY_LIMIT:3,AD_REWARD:10},'./booster':{resetBoost:()=>{}},'./skins':{resetSkins:()=>{}},
  // 저장 키 목록은 실제 모듈을 그대로 씀 (지우기도 같은 가짜 저장소에서)
  './local-data':load('local-data',{'@react-native-async-storage/async-storage':{__esModule:true,default:storage}}),
  './kakao-login':{kakaoSignIn:async()=>null},
  './stats':{dateKey:()=> '2026-11-13'},'./notify':{cancelAllNotifications:async()=>{},rescheduleReminders:async()=>{}},
  './auth':{mysqlAuth:auth},'./auth-client':authClient,'./record-sync':{syncMySqlRecords,enqueueRecordOperation},
  './types':{DEFAULT_PREFS:{nickname:'',interests:[],level:0,studyMinutes:15,reminderEnabled:true,reminderTime:'21:00'}},
 });
 return {auth,cache,profiles,render:()=>{slot=0;return mod.AppProvider({children:null}).value;}};
}
test('actual AppProvider keeps guest data, syncs after login and isolates account switching',async()=>{
 const h=stateHarness();let app=h.render();
 await app.startGuest();app=h.render();
 await app.updatePrefs({nickname:'guest',interests:['ds']},{finishOnboarding:true});
 app=h.render();
 await app.addRecord({topicId:'ds-01',memo:'guest memo',score:1,total:7,rp:6,wrong:[],studySec:10});
 app=h.render();assert.equal(app.records.length,1);assert.equal(app.records[0].synced,false);
 assert.ok(h.cache.has('pg.mysql.records'));assert.ok(h.cache.has('pg.mysql.prefs'));
 await app.signIn('account-a','password');app=h.render();
 assert.equal(app.mode,'user');assert.equal(app.records[0].synced,true);assert.equal(app.prefs.nickname,'guest');
 assert.equal(h.profiles.get('account-a').nickname,'guest');
 await app.signOut();app=h.render();assert.equal(app.mode,'none');assert.equal(app.records.length,0);
 assert.ok(h.cache.has('pg.mysql.local.account-a'));
 await app.signIn('account-b','password');app=h.render();assert.equal(app.records.length,0);assert.equal(app.prefs.nickname,'');
 await app.signIn('account-a','password');app=h.render();assert.equal(app.records.length,1);assert.equal(app.prefs.nickname,'guest');
 await app.removeRecord(app.records[0].id);app=h.render();assert.equal(app.records.length,0);
 await app.deleteAccount();app=h.render();assert.equal(app.mode,'none');assert.equal(h.cache.has('pg.mysql.local.account-a'),false);
});

test('AppProvider waits for wallet confirmation and retains request UUID across lost responses',async()=>{
 const h=stateHarness(),calls=[];let fail=true;
 const value={balance:30,revision:'0',claims:[],state:{freezes:0,boughtTickets:0,freeTickets:2,month:'2026-11',premium:false,keptDays:[]}};
 h.auth.getWallet=async()=>structuredClone(value);
 h.auth.apiRequest=async()=>({uid:'ABCDEFGH'});
 h.auth.walletOperation=async(id,action)=>{calls.push([id,action]);if(fail)throw new AuthApiError('network_error');return {...structuredClone(value),balance:0,revision:'1',state:{...value.state,freezes:1}};};
 let app=h.render();await app.signIn('account-a','password');app=h.render();assert.equal(app.gears,30);
 assert.equal(await app.buyFreeze(),false);app=h.render();assert.equal(app.gears,30);assert.equal(app.freezes,0);
 assert(h.cache.has('pg.mysql.wallet.pending.account-a'));fail=false;
 assert.equal(await app.buyFreeze(),true);app=h.render();assert.equal(app.gears,0);assert.equal(app.freezes,1);
 assert.equal(calls[0][0],calls[1][0]);assert.equal(h.cache.has('pg.mysql.wallet.pending.account-a'),false);
});

test('speed XP is restored from the server without creating study records and is isolated by account',async()=>{
 const h=stateHarness();let totalXp=20;
 h.auth.getSpeedStats=async()=>({totalXp});
 let app=h.render();await app.signIn('speed-a','password');app=h.render();assert.equal(app.xp,20);assert.equal(app.records.length,0);
 totalXp=40;await app.refreshSpeedXp();app=h.render();assert.equal(app.xp,40);
 await app.signOut();app=h.render();assert.equal(app.xp,0);
 totalXp=0;await app.signIn('speed-b','password');app=h.render();assert.equal(app.xp,0);assert.equal(app.records.length,0);
});
test('development seed records stay guest-only and never enter account synchronization',async()=>{
 const previous=globalThis.__DEV__;globalThis.__DEV__=true;
 try{const h=stateHarness();let app=h.render();await app.startGuest();app=h.render();app.devSeedRecords(['ds-01','ds-02']);app=h.render();assert.equal(app.records.length,2);assert(app.records.every(r=>r.devOnly));
 await app.signIn('seed-account','password');app=h.render();assert.equal(app.records.length,0);app.devSeedRecords(['ds-03']);app=h.render();assert.equal(app.records.length,0);
 await app.signOut();app=h.render();await app.startGuest();app=h.render();globalThis.__DEV__=false;app.devSeedRecords(['ds-01']);app=h.render();assert.equal(app.records.length,0);
 }finally{if(previous===undefined)delete globalThis.__DEV__;else globalThis.__DEV__=previous;}
});
test('speed client retries the same start UUID and never grants local practice XP',async()=>{
 const cache=new Map(),calls=[];let id='user-a',fail=true,uuids=0;
 const storage={getItem:async k=>cache.get(k)??null,setItem:async(k,v)=>cache.set(k,v),removeItem:async k=>cache.delete(k)};
 const auth={getUserId:()=>id,getSpeedStats:async()=>({best:1,day:'2026-11-13',xpToday:3,plays:1,totalXp:3}),apiRequest:async(path,body)=>{calls.push({path,body});if(fail)throw new AuthApiError('network_error');return {runId:'run-a',question:null,completed:true};}};
 const speed=load('speed',{'@react-native-async-storage/async-storage':{__esModule:true,default:storage},'expo-crypto':{randomUUID:()=>`uuid-${++uuids}`},'./auth':{mysqlAuth:auth},'./auth-client':authClient,'./stats':{dateKey:()=> '2026-11-13'}});
 assert.equal((await speed.readSpeed(false)).totalXp,0);assert.equal(calls.length,0);
 const practiced=await speed.finishPractice(7);assert.equal(practiced.xp,0);assert.equal((await speed.readSpeed(false)).best,7);assert.equal((await speed.readSpeed(false)).totalXp,0);
 await assert.rejects(speed.startSpeed(),{code:'network_error'});fail=false;await speed.startSpeed();assert.equal(calls[0].body.requestId,calls[1].body.requestId);assert.equal(uuids,1);
 id=null;await assert.rejects(speed.startSpeed(),{code:'unauthorized'});assert.equal(calls.length,2);
});
