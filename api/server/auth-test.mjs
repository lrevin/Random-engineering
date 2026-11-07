import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID,randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { SignJWT } from 'jose';
import bcrypt from 'bcryptjs';
import { connect } from './db.mjs';
import { createAuth,tokenHash } from './auth.mjs';
import { databaseStore } from './db-store.mjs';
import { createServer } from './server.mjs';
import { ROOT } from '../shared/question-store.mjs';

function appClient() {
  const ts=createRequire(path.join(ROOT,'app/package.json'))('typescript');
  const activeClient=path.join(ROOT,'app/src/lib/auth-client.ts');
  const clientFile=fs.existsSync(activeClient)?activeClient:path.join(ROOT,'api/mysql/app-integration/app/src/lib/auth-client.ts');
  const code=ts.transpileModule(fs.readFileSync(clientFile,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText;
  const exported={};new Function('exports',code)(exported);return exported.createAuthClient;
}
function storage() { let raw=null;return {read:async()=>raw,write:async value=>{raw=value;},remove:async()=>{raw=null;}}; }

test('MySQL authentication HTTP and app login persistence',async t=>{
  const db=await connect(),secret=randomBytes(48).toString('base64url'),prefix=`auth-test-${randomUUID()}`;
  const auth=createAuth({secret});
  const server=createServer({store:databaseStore(db),auth,authLimits:{signup:100,login:100,refresh:100,logout:100,me:100}});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    const [rows]=await db.execute("SELECT user_id FROM auth_identities WHERE provider='email' AND provider_subject LIKE ?",[`${prefix}%`]);
    for(const row of rows) await db.execute('DELETE FROM users WHERE id=?',[row.user_id]);
    await db.end();
  });
  const pass='Strong-Test-42!';
  const post=async(route,body)=>{
    const response=await fetch(`${base}/auth/${route}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    return {status:response.status,headers:response.headers,data:response.status===204?null:await response.json()};
  };
  const me=token=>fetch(`${base}/auth/me`,{headers:token?{Authorization:`Bearer ${token}`}:{}});
  const make=async suffix=>{
    const result=await post('signup',{email:`${prefix}-${suffix}@example.com`,password:pass});
    assert.equal(result.status,201);return result.data;
  };
  let original;

  await t.test('signup normalizes email; persists bcrypt-12 and hashed refresh token only',async()=>{
    const email=`${prefix}-primary@example.com`;
    const result=await post('signup',{email:` ${email.toUpperCase()} `,password:pass});
    assert.equal(result.status,201);assert.equal(result.headers.get('cache-control'),'no-store');
    original=result.data;assert.equal(original.user.email,email);
    assert.equal(original.expiresIn,900);
    const [[identity]]=await db.execute("SELECT password_hash,provider_subject FROM auth_identities WHERE user_id=?",[original.user.id]);
    assert.equal(bcrypt.getRounds(identity.password_hash),12);assert.notEqual(identity.password_hash,pass);
    assert.ok(await bcrypt.compare(pass,identity.password_hash));
    const [[token]]=await db.execute('SELECT token_hash FROM refresh_tokens WHERE token_hash=?',[tokenHash(original.refreshToken)]);
    assert.ok(token.token_hash.equals(tokenHash(original.refreshToken)));
    const [[state]]=await db.execute('SELECT last_change_seq FROM user_sync_states WHERE user_id=?',[original.user.id]);assert.equal(Number(state.last_change_seq),0);
    const [[user]]=await db.execute('SELECT email_verified_at FROM users WHERE id=?',[original.user.id]);assert.equal(user.email_verified_at,null);
    assert.equal((await me(original.accessToken)).status,200);
  });
  await t.test('duplicate signup, invalid fields, 72-byte bcrypt boundary',async()=>{
    assert.equal((await post('signup',{email:original.user.email,password:pass})).status,409);
    for(const password of ['abcdefgh','Abcdefgh','Short1!',`Aa1!${'한'.repeat(24)}`]) {
      const r=await post('signup',{email:`${prefix}-weak@example.com`,password});assert.equal(r.status,400);assert.equal(r.data.error,'weak_password');
    }
    assert.equal((await post('signup',{email:'bad address',password:pass})).status,400);
  });
  await t.test('login validates credentials and creates a separate session',async()=>{
    for(const email of [original.user.email,`${prefix}-missing@example.com`]) {
      const r=await post('login',{email,password:'Wrong-Password-42!'});assert.equal(r.status,401);assert.equal(r.data.error,'invalid_credentials');
    }
    const r=await post('login',{email:original.user.email,password:pass});assert.equal(r.status,200);assert.notEqual(r.data.refreshToken,original.refreshToken);
    assert.equal((await post('logout',{refreshToken:r.data.refreshToken})).status,204);
    assert.equal((await me(original.accessToken)).status,200);
  });
  await t.test('refresh rotates once; replay revokes that session but not another login',async()=>{
    const r=await post('refresh',{refreshToken:original.refreshToken});assert.equal(r.status,200);
    assert.notEqual(r.data.refreshToken,original.refreshToken);
    const [[bounds]]=await db.execute(`SELECT t.expires_at=s.expires_at AS same_expiry FROM refresh_tokens t
      JOIN auth_sessions s ON s.id=t.session_id WHERE t.token_hash=?`,[tokenHash(r.data.refreshToken)]);assert.equal(Number(bounds.same_expiry),1);
    const other=await post('login',{email:original.user.email,password:pass});assert.equal(other.status,200);
    assert.equal((await post('refresh',{refreshToken:original.refreshToken})).status,401);
    assert.equal((await post('refresh',{refreshToken:r.data.refreshToken})).status,401);
    assert.equal((await post('refresh',{refreshToken:other.data.refreshToken})).status,200);
  });
  await t.test('concurrent refresh has one winner and replay is rejected',async()=>{
    const s=await make('concurrent');
    const results=await Promise.all([post('refresh',{refreshToken:s.refreshToken}),post('refresh',{refreshToken:s.refreshToken})]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,401]);
    const winner=results.find(r=>r.status===200).data;
    assert.equal((await post('refresh',{refreshToken:winner.refreshToken})).status,401);
  });
  await t.test('logout is idempotent, blocks refresh; existing access lasts until expiry by policy',async()=>{
    const s=await make('logout');
    assert.equal((await post('logout',{refreshToken:s.refreshToken})).status,204);
    assert.equal((await post('logout',{refreshToken:s.refreshToken})).status,204);
    assert.equal((await post('refresh',{refreshToken:s.refreshToken})).status,401);
    assert.equal((await me(s.accessToken)).status,200);
  });
  await t.test('JWT expiry, signature, audience, account auth_version and deleting status',async()=>{
    const s=await make('jwt');
    assert.equal((await me()).status,401);assert.equal((await me(`${s.accessToken}x`)).status,401);
    const key=new TextEncoder().encode(secret);
    const expired=await new SignJWT({av:1}).setProtectedHeader({alg:'HS256'}).setSubject(s.user.id).setIssuer('ppobgong-api').setAudience('ppobgong-app').setExpirationTime(1).sign(key);
    const wrongAudience=await new SignJWT({av:1}).setProtectedHeader({alg:'HS256'}).setSubject(s.user.id).setIssuer('ppobgong-api').setAudience('other').setExpirationTime('15m').sign(key);
    assert.equal((await me(expired)).status,401);assert.equal((await me(wrongAudience)).status,401);
    await db.execute('UPDATE users SET auth_version=2 WHERE id=?',[s.user.id]);assert.equal((await me(s.accessToken)).status,401);
    const next=await post('refresh',{refreshToken:s.refreshToken});assert.equal(next.status,200);assert.equal((await me(next.data.accessToken)).status,200);
    await db.execute("UPDATE users SET status='deleting',deletion_requested_at=UTC_TIMESTAMP(3) WHERE id=?",[s.user.id]);
    assert.equal((await me(next.data.accessToken)).status,401);
    assert.equal((await post('refresh',{refreshToken:next.data.refreshToken})).status,401);
    assert.equal((await post('login',{email:s.user.email,password:pass})).status,401);
  });
  await t.test('expired sessions cannot refresh',async()=>{
    const s=await make('expired');
    await db.execute(`UPDATE auth_sessions s JOIN refresh_tokens t ON t.session_id=s.id
      SET s.created_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 2 DAY),s.expires_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 DAY) WHERE t.token_hash=?`,[tokenHash(s.refreshToken)]);
    assert.equal((await post('refresh',{refreshToken:s.refreshToken})).status,401);
  });
  await t.test('malformed JSON, large body, wrong method and CORS',async()=>{
    assert.equal((await post('login',null)).status,400);
    const bad=await fetch(`${base}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});assert.equal(bad.status,400);
    assert.equal((await post('login',{value:'x'.repeat(17000)})).status,413);
    assert.equal((await fetch(`${base}/auth/login`)).status,405);
    const cors=await fetch(`${base}/auth/login`,{method:'OPTIONS'});assert.equal(cors.status,204);assert.match(cors.headers.get('access-control-allow-headers'),/authorization/);
  });
  await t.test('rate limit rejects excess attempts without authenticating',async()=>{
    const limited=createServer({store:databaseStore(db),auth,authLimits:{login:1}});limited.listen(0,'127.0.0.1');await once(limited,'listening');
    try {
      const address=`http://127.0.0.1:${limited.address().port}/auth/login`;
      const opts={method:'POST',headers:{'Content-Type':'application/json'},body:'{}'};
      assert.equal((await fetch(address,opts)).status,400);assert.equal((await fetch(address,opts)).status,429);
    } finally {limited.closeAllConnections();await new Promise(resolve=>limited.close(resolve));}
  });
  const createClient=appClient();
  await t.test('actual app client signs in, restores saved login, rotates once for concurrent calls',async()=>{
    const saved=storage(),client=createClient(base,saved);
    const session=await client.signUp(`${prefix}-app@example.com`,pass);
    const restored=createClient(base,saved);assert.equal((await restored.restore()).user.id,session.user.id);
    const rotated=await Promise.all([restored.refresh(),restored.refresh(),restored.refresh()]);
    assert.equal(new Set(rotated.map(x=>x.refreshToken)).size,1);
    await restored.signOut();assert.equal(await saved.read(),null);
    assert.equal((await post('refresh',{refreshToken:rotated[0].refreshToken})).status,401);
  });
  await t.test('app restores expired access via refresh and clears invalid refresh session',async()=>{
    const saved=storage(),client=createClient(base,saved);
    const s=await client.signUp(`${prefix}-restore@example.com`,pass);
    await saved.write(JSON.stringify({...s,expiresAt:1}));
    const restored=createClient(base,saved);const next=await restored.restore();assert.notEqual(next.refreshToken,s.refreshToken);
    await post('logout',{refreshToken:next.refreshToken});
    await saved.write(JSON.stringify({...next,expiresAt:1}));
    assert.equal(await createClient(base,saved).restore(),null);assert.equal(await saved.read(),null);
  });
  await t.test('network failures preserve stored login; logout never restores an in-flight refresh',async()=>{
    const saved=storage(),client=createClient(base,saved);
    const s=await client.signUp(`${prefix}-offline@example.com`,pass);
    const offline=createClient(base,saved,async()=>{throw new Error('offline');});assert.equal((await offline.restore()).user.id,s.user.id);assert.notEqual(await saved.read(),null);
    let unblock,started;
    const entered=new Promise(resolve=>{started=resolve;});
    const gate=new Promise(resolve=>{unblock=resolve;});
    const delayed=createClient(base,saved,async(url,opts)=>{
      const response=await fetch(url,opts);
      if(url.endsWith('/auth/refresh')) {started();await gate;}
      return response;
    });
    await delayed.restore();
    const pending=delayed.refresh().catch(e=>e);
    await entered;await delayed.signOut();unblock();
    assert.equal((await pending).code,'session_changed');assert.equal(await saved.read(),null);
  });
});
