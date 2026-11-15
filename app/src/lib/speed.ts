import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import {mysqlAuth} from "./auth";
import {AuthApiError} from "./auth-client";
import type {Topic} from "@/data";
import type {ExamItem} from "./quiz";
import {dateKey} from "./stats";
export const speedNow=()=>Date.now();
export const SPEED_SEC=60;
export const SPEED_XP_PER_CORRECT=3;
export const SPEED_DAILY_XP_CAP=150;
export interface SpeedStore {best:number;day:string;xpToday:number;plays:number;totalXp:number}
export interface SpeedQuestion {position:number;topic:Topic;q:{type:'mc';q:string;choices:string[];src?:'bank'}}
export interface SpeedRun {runId:string;deadlineAt:string;serverNow:string;question:SpeedQuestion|null;completed:boolean}
const empty=():SpeedStore=>({best:0,day:dateKey(new Date()),xpToday:0,plays:0,totalXp:0});
function owner(){const id=mysqlAuth.getUserId();if(!id)throw new AuthApiError('unauthorized',401);return id;}
function same(id:string){if(mysqlAuth.getUserId()!==id)throw new AuthApiError('session_changed');}
export async function readSpeed(member=false):Promise<SpeedStore>{
 if(!member){try{const old=JSON.parse(await AsyncStorage.getItem("pg.speed")??"null");return {...empty(),best:Number.isFinite(old?.best)?Math.max(0,old.best):0,plays:Number.isFinite(old?.plays)?Math.max(0,old.plays):0};}catch{return empty();}}const id=owner();
 try{const result=await mysqlAuth.getSpeedStats();same(id);await AsyncStorage.setItem('pg.mysql.speed.stats.'+id,JSON.stringify(result));return result;}
 catch(e){same(id);if(!(e instanceof AuthApiError)||e.code!=='network_error')throw e;try{return JSON.parse(await AsyncStorage.getItem('pg.mysql.speed.stats.'+id)??'null')??empty();}catch{return empty();}}
}
export async function startSpeed():Promise<SpeedRun>{
 const id=owner(),key='pg.mysql.speed.start.'+id;
 let requestId=await AsyncStorage.getItem(key);same(id);if(!requestId){requestId=Crypto.randomUUID();await AsyncStorage.setItem(key,requestId);same(id);}
 const run=await mysqlAuth.apiRequest('/me/speed/runs',{requestId},'POST') as SpeedRun;same(id);
 await AsyncStorage.setItem('pg.mysql.speed.run.'+id,run.runId);await AsyncStorage.removeItem(key);return run;
}
export async function answerSpeed(runId:string,position:number,answer:number):Promise<{correct:boolean;answer:number;explain:string;next:SpeedQuestion|null}>{return mysqlAuth.apiRequest('/me/speed/runs/'+runId+'/answers',{position,answer},'POST');}
let practiceWrites:Promise<unknown>=Promise.resolve();
export function finishPractice(correct:number){
 const run=practiceWrites.catch(()=>{}).then(async()=>{
  const old=await readSpeed(false),count=Math.max(0,Math.min(240,Math.floor(correct))),store={...empty(),best:Math.max(old.best,count),plays:old.plays+1};
  await AsyncStorage.setItem("pg.speed",JSON.stringify(store));return {store,xp:0,newBest:count>old.best,correct:count};
 });practiceWrites=run;return run;
}
export async function finishSpeed(runId:string):Promise<{store:SpeedStore;xp:number;newBest:boolean;correct:number;total:number}>{
 const id=owner();const result=await mysqlAuth.apiRequest('/me/speed/runs/'+runId+'/finish',{},'POST');same(id);
 await AsyncStorage.setItem('pg.mysql.speed.stats.'+id,JSON.stringify(result.store));return result;
}
export const speedItem=(item:SpeedQuestion):ExamItem=>({topic:item.topic,q:{...item.q,answer:-1,explain:''}});
export function speedMessage(e:unknown){const code=e instanceof AuthApiError?e.code:'';return ({speed_no_questions:'서버에 공부한 주제의 객관식 문제가 없어요. 연습 모드를 이용해 주세요.',speed_expired:'제한 시간이 끝났어요. 서버에서 결과를 확인해 주세요.',unauthorized:'로그인 후 다시 시도해 주세요.',answer_conflict:'먼저 제출한 답안을 다시 확인해 주세요.'} as Record<string,string>)[code]??'서버에 연결하지 못했어요. 다시 시도하거나 XP 없는 연습 모드를 이용해 주세요.';}
