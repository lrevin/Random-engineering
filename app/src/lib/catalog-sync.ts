import AsyncStorage from "@react-native-async-storage/async-storage";
import {applyCatalog, type RemoteCatalog} from "@/data";
import {API_URL} from "./api";
const KEY="pg.mysql.catalog.v1";
let revision=0;const listeners=new Set<()=>void>();
export const catalogRevision=()=>revision;
export const subscribeCatalog=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
function changed(){revision++;for(const fn of listeners)fn();}
export async function restoreCatalog(){try{const raw=await AsyncStorage.getItem(KEY);if(raw){applyCatalog(JSON.parse(raw));changed();}}catch{/* Keep bundled data if a cache is corrupt. */}}
let pending:Promise<boolean>|null=null;
export function syncCatalog(){if(pending)return pending;pending=fetchCatalog().finally(()=>{pending=null;});return pending;}
async function fetchCatalog(){
 const raw=await AsyncStorage.getItem(KEY);let old:RemoteCatalog|undefined;try{old=raw?JSON.parse(raw):undefined;}catch{}
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),10000);
 try{
  const res=await fetch(API_URL+'/catalog',{headers:old?.version?{'If-None-Match':'"'+old.version+'"'}:{},signal:ctrl.signal});
  if(res.status===304)return false;if(!res.ok)throw new Error('목록을 갱신하지 못했어요.');
  const data=await res.json();
  // Validate without mutation before replacing the last good durable cache.
  applyCatalog(data,true);await AsyncStorage.setItem(KEY,JSON.stringify(data));applyCatalog(data);changed();return true;
 }finally{clearTimeout(timer);}
}
