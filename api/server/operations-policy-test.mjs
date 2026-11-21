import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {parseOperations} from '../mysql/operations.mjs';
import {maintenanceOptions} from '../mysql/operations-service.mjs';
import {fileRetention,createBackup,restoreCheck,verifyBackup,latestVerifiedBackup,rdsBackupStatus,registerRelease,rdsRecoverySummary,MARKER} from '../mysql/operations-files.mjs';
test('운영 정리는 기본 미리보기이며 잘못된 인자·과도한 묶음을 거절',()=>{
 assert.equal(parseOperations(['maintenance']).apply,false);assert.equal(parseOperations(['maintenance','--apply','--limit','20']).limit,20);
 for(const args of [['maintenance','--limit','1001'],['maintenance','--unknown'],['maintenance','--limit','-1']])assert.throws(()=>parseOperations(args));
 assert.throws(()=>maintenanceOptions({limit:0}));assert.throws(()=>maintenanceOptions({apply:'true'}));
});
test('백업은 명시 실행 전 도구 호출 없이 계획만 반환하고 복원은 격리된 주소만 허용',async()=>{
 assert.equal((await createBackup({root:'unused',source:'unused',serviceConfig:'unused'})).mode,'preview');
 for(const port of [3306,0,undefined])await assert.rejects(restoreCheck({backup:'unused',port,user:'root'}),/ISOLATED/);
 await assert.rejects(restoreCheck({backup:'unused',host:'example.com',port:33323,user:'root'}),/ISOLATED/);
});
test('백업 파일 정리는 최근 세 개·30일을 보존하고 미등록 폴더는 건드리지 않음',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ppobgong-ops-files-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const now=new Date('2026-11-21T00:00:00Z');
 for(let i=0;i<5;i++){const dir=path.join(root,'backup-'+i);await fs.mkdir(dir);await fs.writeFile(path.join(dir,MARKER),JSON.stringify({version:1,kind:'backup',complete:true,createdAt:new Date(+now-(i+35)*86400000).toISOString()}));}
 await fs.mkdir(path.join(root,'unmanaged'));await fs.mkdir(path.join(root,'incomplete'));await fs.writeFile(path.join(root,'incomplete',MARKER),JSON.stringify({version:1,kind:'backup',complete:false,createdAt:'2020-01-01'}));
 const preview=await fileRetention({root,kind:'backup',now});assert.equal(preview.managed.filter(x=>x.selected).length,2);assert.equal((await fs.readdir(root)).length,7);
 const applied=await fileRetention({root,kind:'backup',now,apply:true});assert.equal(applied.managed.filter(x=>x.deleted).length,2);assert.equal((await fs.readdir(root)).length,5);
});
test('릴리스 정리는 오래된 현재 버전과 미등록 폴더를 보존',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ppobgong-ops-releases-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 for(let i=0;i<5;i++){const dir=path.join(root,'release-'+i);await fs.mkdir(dir);await fs.writeFile(path.join(dir,MARKER),JSON.stringify({version:1,kind:'release',complete:true,createdAt:new Date(Date.UTC(2026,10,20-i)).toISOString()}));}
 await assert.rejects(fileRetention({root,kind:'release'}),/CURRENT/);
 const result=await fileRetention({root,kind:'release',current:path.join(root,'release-4'),apply:true});assert.equal(result.managed.filter(x=>x.deleted).length,1);assert.equal((await fs.stat(path.join(root,'release-4'))).isDirectory(),true);
});

test('최근 정상 백업 없이 자동 삭제를 실행할 수 없고 임의 파일은 백업으로 인정하지 않는다',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ppobgong-ops-empty-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await assert.rejects(latestVerifiedBackup(root),/RECENT_BACKUP/);await assert.rejects(verifyBackup(root));
});

test('RDS 조회 도구 누락은 비밀값 없는 오류로 종료한다',async()=>{
 await assert.rejects(rdsBackupStatus('test-db','ppobgong-tool-that-does-not-exist'),/TOOL_UNAVAILABLE/);
});
test('실제 릴리스 구조만 관리 대상으로 등록하고 기존 표시를 덮어쓰지 않는다',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ppobgong-ops-register-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const dir=path.join(root,'release-1','api','server');await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'package.json'),'{}');
 await assert.rejects(registerRelease({root,name:'../outside',apply:true}),/INVALID_RELEASE/);
 assert.equal((await registerRelease({root,name:'release-1'})).mode,'preview');
 await registerRelease({root,name:'release-1',apply:true});await assert.rejects(registerRelease({root,name:'release-1',apply:true}),{code:'EEXIST'});
});

test('운영 RDS는 1일 보관을 인정하고 복구 시점 누락·오래된 시점은 경고',()=>{
 const now=new Date('2026-11-21T12:00:00Z');
 const good=rdsRecoverySummary({retention:1,latestRestorable:'2026-11-21T11:55:00Z'},now);assert.equal(good.recommendedRetentionDays,1);assert.equal(good.retentionOk,true);assert.equal(good.pitrAvailable,true);
 assert.equal(rdsRecoverySummary({retention:0,latestRestorable:null},now).retentionOk,false);assert.equal(rdsRecoverySummary({retention:1,latestRestorable:'2026-11-19T12:00:00Z'},now).pitrAvailable,false);
});
