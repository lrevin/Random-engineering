import { randomBytes, randomUUID, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { connect, transaction } from './db.mjs';

const ISSUER = 'ppobgong-api', AUDIENCE = 'ppobgong-app';
export const tokenHash = token => createHash('sha256').update(token).digest();
export class AuthError extends Error {
  constructor(code, status=400) { super(code); this.code=code; this.status=status; }
}
export async function passwordMatches(value, hash) {
  return typeof value==='string' && Buffer.byteLength(value,'utf8')<=72 && !!value && typeof hash==='string' ? bcrypt.compare(value,hash) : false;
}
export function normalizeEmail(value) {
  if (typeof value !== 'string') throw new AuthError('bad_request');
  const email=value.trim().toLowerCase();
  if (email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError('invalid_email');
  return email;
}
function password(value, signup=false) {
  if (typeof value!=='string' || Buffer.byteLength(value,'utf8')>72 || !value) throw new AuthError(signup?'weak_password':'invalid_credentials',signup?400:401);
  if (signup && (value.length<8 || !/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/[0-9]/.test(value) || !/[^a-zA-Z0-9\s]/.test(value))) throw new AuthError('weak_password');
  return value;
}
function refreshToken(value) {
  if (typeof value!=='string' || !/^[a-zA-Z0-9_-]{64}$/.test(value)) throw new AuthError('unauthorized',401);
  return value;
}

export function createAuth({ secret=process.env.JWT_SECRET, connectionFactory=connect, accessSeconds=900, sessionDays=30 }={}) {
  if (typeof secret!=='string' || Buffer.byteLength(secret)<32) throw new Error('JWT_SECRET must contain at least 32 bytes');
  const key=new TextEncoder().encode(secret);
  const dummy=bcrypt.hash(randomBytes(32).toString('hex'),12);
  async function withDb(fn) { const db=await connectionFactory(); try { return await fn(db); } finally { await db.end(); } }
  async function access(user) {
    return new SignJWT({av:user.auth_version}).setProtectedHeader({alg:'HS256',typ:'JWT'}).setSubject(user.id)
      .setIssuer(ISSUER).setAudience(AUDIENCE).setIssuedAt().setExpirationTime(`${accessSeconds}s`).sign(key);
  }
  async function newSession(db,user,email) {
    const id=randomUUID(), token=randomBytes(48).toString('base64url');
    await db.execute('INSERT INTO auth_sessions(id,user_id,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL ? DAY))',[id,user.id,sessionDays]);
    await db.execute('INSERT INTO refresh_tokens(token_hash,session_id,expires_at) SELECT ?,id,expires_at FROM auth_sessions WHERE id=?',[tokenHash(token),id]);
    return { accessToken:await access(user),refreshToken:token,expiresIn:accessSeconds,user:{id:user.id,email} };
  }
  async function verifyAccess(header) {
    if(typeof header!=='string' || !header.startsWith('Bearer ')) throw new AuthError('unauthorized',401);
    let payload;
    try { ({payload}=await jwtVerify(header.slice(7),key,{algorithms:['HS256'],issuer:ISSUER,audience:AUDIENCE})); }
    catch { throw new AuthError('unauthorized',401); }
    if(typeof payload.sub!=='string' || !Number.isInteger(payload.av)) throw new AuthError('unauthorized',401);
    return payload;
  }
  return {
    verifyAccess,
    async signup(body) {
      const email=normalizeEmail(body.email), hash=await bcrypt.hash(password(body.password,true),12);
      try {
        return await withDb(db=>transaction(db,async()=>{
          const user={id:randomUUID(),auth_version:1};
          await db.execute('INSERT INTO users(id) VALUES (?)',[user.id]);
          await db.execute("INSERT INTO auth_identities(id,user_id,provider,provider_subject,email,password_hash) VALUES (?,?,'email',?,?,?)",[randomUUID(),user.id,email,email,hash]);
          await db.execute('INSERT INTO user_sync_states(user_id) VALUES (?)',[user.id]);
          // Email verification is not introduced yet: email_verified_at stays NULL.
          return newSession(db,user,email);
        }));
      } catch(error) { if(error.code==='ER_DUP_ENTRY') throw new AuthError('email_taken',409); throw error; }
    },
    async login(body) {
      const email=normalizeEmail(body.email), plain=password(body.password);
      return withDb(async db=>{
        const [[identity]]=await db.execute("SELECT user_id,password_hash FROM auth_identities WHERE provider='email' AND provider_subject=?",[email]);
        const matches=await bcrypt.compare(plain,identity?.password_hash ?? await dummy);
        if(!identity || !matches) throw new AuthError('invalid_credentials',401);
        return transaction(db,async()=>{
          const [[user]]=await db.execute('SELECT id,status,auth_version FROM users WHERE id=? FOR UPDATE',[identity.user_id]);
          const [[current]]=await db.execute("SELECT password_hash FROM auth_identities WHERE user_id=? AND provider='email'",[identity.user_id]);
          if(!user || current?.password_hash!==identity.password_hash) throw new AuthError('invalid_credentials',401);
          if(user.status==='deleting') throw new AuthError('account_deleting',401);
          if(user.status!=='active') throw new AuthError('invalid_credentials',401);
          return newSession(db,user,email);
        });
      });
    },
    async refresh(body) {
      const hash=tokenHash(refreshToken(body.refreshToken));
      const result=await withDb(async db=>{
        const [[lookup]]=await db.execute('SELECT t.session_id,s.user_id FROM refresh_tokens t JOIN auth_sessions s ON s.id=t.session_id WHERE t.token_hash=?',[hash]);
        if(!lookup) throw new AuthError('unauthorized',401);
        return transaction(db,async()=>{
          // Common lock order: account -> session -> token.
          const [[user]]=await db.execute('SELECT id,status,auth_version FROM users WHERE id=? FOR UPDATE',[lookup.user_id]);
          const [[session]]=await db.execute('SELECT id,revoked_at,expires_at>UTC_TIMESTAMP(3) AS valid FROM auth_sessions WHERE id=? FOR UPDATE',[lookup.session_id]);
          const [[token]]=await db.execute('SELECT consumed_at,revoked_at,expires_at>UTC_TIMESTAMP(3) AS valid FROM refresh_tokens WHERE token_hash=? FOR UPDATE',[hash]);
          if(!user || user.status!=='active' || !session || session.revoked_at || !Number(session.valid) || !token || token.revoked_at || !Number(token.valid)) throw new AuthError('unauthorized',401);
          if(token.consumed_at) {
            // Commit replay revocation; throwing inside would roll it back.
            await db.execute('UPDATE auth_sessions SET revoked_at=UTC_TIMESTAMP(3) WHERE id=?',[session.id]);
            await db.execute('UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,UTC_TIMESTAMP(3)) WHERE session_id=?',[session.id]);
            return null;
          }
          const next=randomBytes(48).toString('base64url');
          await db.execute('UPDATE refresh_tokens SET consumed_at=UTC_TIMESTAMP(3) WHERE token_hash=?',[hash]);
          await db.execute('INSERT INTO refresh_tokens(token_hash,session_id,expires_at) SELECT ?,id,expires_at FROM auth_sessions WHERE id=?',[tokenHash(next),session.id]);
          const [[identity]]=await db.execute("SELECT email FROM auth_identities WHERE user_id=? AND provider='email'",[user.id]);
          return {accessToken:await access(user),refreshToken:next,expiresIn:accessSeconds,user:{id:user.id,email:identity?.email ?? null}};
        });
      });
      if(!result) throw new AuthError('unauthorized',401);
      return result;
    },
    async logout(body) {
      const hash=tokenHash(refreshToken(body.refreshToken));
      await withDb(async db=>{
        const [[lookup]]=await db.execute('SELECT t.session_id,s.user_id FROM refresh_tokens t JOIN auth_sessions s ON s.id=t.session_id WHERE t.token_hash=?',[hash]);
        if(!lookup) return;
        await transaction(db,async()=>{
          await db.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[lookup.user_id]);
          await db.execute('SELECT id FROM auth_sessions WHERE id=? FOR UPDATE',[lookup.session_id]);
          await db.execute('UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,UTC_TIMESTAMP(3)) WHERE id=?',[lookup.session_id]);
          await db.execute('UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,UTC_TIMESTAMP(3)) WHERE session_id=?',[lookup.session_id]);
        });
      });
    },
    async me(header) {
      const payload=await verifyAccess(header);
      return withDb(async db=>{
        const [[user]]=await db.execute("SELECT u.id,u.status,u.auth_version,i.email FROM users u LEFT JOIN auth_identities i ON i.user_id=u.id AND i.provider='email' WHERE u.id=?",[payload.sub]);
        if(!user || user.status!=='active' || user.auth_version!==payload.av) throw new AuthError('unauthorized',401);
        return {user:{id:user.id,email:user.email}};
      });
    },
  };
}
