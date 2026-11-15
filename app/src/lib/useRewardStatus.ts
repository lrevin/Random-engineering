import {useCallback,useEffect,useState} from 'react';
import {useFocusEffect} from 'expo-router';
import {mysqlAuth,authErrorMessage} from './auth';
import {questDateKey} from './quest-time';
import {useApp} from './app-state';
import type {RewardStatus} from './reward-types';
const running=new Map<string,Promise<RewardStatus>>();
const cache=new Map<string,{at:number;value:RewardStatus}>();
async function load(owner:string){
 const old=cache.get(owner);if(old&&Date.now()-old.at<1000)return old.value;
 let task=running.get(owner);
 if(!task){task=mysqlAuth.rewardStatus().then(value=>{if(mysqlAuth.getUserId()===owner)cache.set(owner,{at:Date.now(),value});return value;}).finally(()=>running.delete(owner));running.set(owner,task);}
 return task;
}
// 보상 화면은 기기의 완료 표시 대신 현재 회원의 서버 증거를 표시한다.
export function useRewardStatus(){
 const {mode,gears,records,prefs}=useApp(),owner=mode==='user'?mysqlAuth.getUserId():null;
 const [state,setState]=useState<{owner:string|null;value:RewardStatus|null}>({owner:null,value:null});
 const [error,setError]=useState(''),day=questDateKey();
 const refresh=useCallback(async()=>{
  if(!owner){setState({owner:null,value:null});return null;}
  try{const value=await load(owner);if(mysqlAuth.getUserId()!==owner)return null;setState({owner,value});setError('');return value;}
  catch(e){if(mysqlAuth.getUserId()===owner)setError(authErrorMessage(e));return null;}
 },[owner]);
 useFocusEffect(useCallback(()=>{void refresh();},[refresh]));
 useEffect(()=>{void Promise.resolve().then(refresh);},[refresh,gears,records,prefs.interests,day]);
 return {rewards:state.owner===owner?state.value:null,error,refresh};
}
