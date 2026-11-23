import AsyncStorage from '@react-native-async-storage/async-storage';
import {LOCAL_KEYS} from './local-data';
import {mysqlAuth} from './auth';
import type {ServerActivity} from './reward-types';
export interface CachedActivity {owner:string;request:{requestId:string;purpose:ServerActivity['purpose'];certId?:string;reviewSource?:'exam'};activity?:ServerActivity;answers:(number|boolean)[]}
const key=()=>LOCAL_KEYS.activities.key.replace(/^pg\./,'pg.mysql.')+'.'+mysqlAuth.getUserId();
export async function readCachedActivity(purpose:ServerActivity['purpose'],examOnly=false):Promise<CachedActivity|null>{
 const raw=await AsyncStorage.getItem(key()+'.'+purpose+(examOnly?'.exam':''));if(!raw)return null;
 const x=JSON.parse(raw) as CachedActivity;return x.owner===mysqlAuth.getUserId()?x:null;
}
export async function saveCachedActivity(x:CachedActivity){
 if(x.owner!==mysqlAuth.getUserId())throw new Error('session_changed');
 await AsyncStorage.setItem(key()+'.'+x.request.purpose+(x.request.reviewSource==='exam'?'.exam':''),JSON.stringify(x));
}
export async function clearCachedActivity(purpose:ServerActivity['purpose'],examOnly=false){await AsyncStorage.removeItem(key()+'.'+purpose+(examOnly?'.exam':''));}

export interface PendingStudyEvent {attemptId:string;event:'pause'|'resume'|'quiz'|'extend';id:string}
export async function readStudyEvent():Promise<PendingStudyEvent|null>{const raw=await AsyncStorage.getItem(key()+'.study-event');return raw?JSON.parse(raw) as PendingStudyEvent:null;}
export async function saveStudyEvent(event:PendingStudyEvent){await AsyncStorage.setItem(key()+'.study-event',JSON.stringify(event));}
export async function clearStudyEvent(){await AsyncStorage.removeItem(key()+'.study-event');}
