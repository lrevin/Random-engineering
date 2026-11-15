import fs from 'node:fs';
import mysql from 'mysql2/promise';

export function databaseName() {
  const name = process.env.MYSQL_DATABASE;
  if (!name || !/^[a-zA-Z0-9_]{1,64}$/.test(name)) throw new Error('MYSQL_DATABASE must be a simple database name');
  return name;
}

export function options({ database = true } = {}) {
  if (!process.env.MYSQL_USER) throw new Error('MYSQL_USER is required');
  const ssl = process.env.MYSQL_SSL_CA ? {
    ca: fs.readFileSync(process.env.MYSQL_SSL_CA, 'utf8'), rejectUnauthorized: true,
  } : undefined;
  return { host: process.env.MYSQL_HOST || '127.0.0.1', port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD || '',
    ...(database ? { database: databaseName() } : {}), ssl, charset: 'utf8mb4',
    timezone: 'Z', dateStrings: true, connectTimeout: 10000, supportBigNumbers: true, bigNumberStrings: true };
}

// API 서버가 켜질 때 useSharedPool()을 부르면, 회원 요청이 매번 새 연결을 여는 대신 풀에서 빌려 씀.
// 스크립트(마이그레이션, admin-grant 등)는 부르지 않으므로 예전처럼 연결을 열고 닫음.
let shared = null;
export function useSharedPool() {
  if (shared) return shared;
  shared = mysql.createPool({ ...options(), connectionLimit: Number(process.env.MYSQL_POOL_SIZE || 10), maxIdle: 5,
    idleTimeout: 60000, waitForConnections: true, queueLimit: 200, enableKeepAlive: true, keepAliveInitialDelay: 0 });
  shared.pool.on('connection', (c) => c.query("SET time_zone='+00:00'"));
  return shared;
}
export async function closeSharedPool() {
  const pool = shared;
  shared = null;
  await pool?.end();
}

export async function connect(config = {}) {
  if (shared && !Object.keys(config).length) {
    const connection = await shared.getConnection();
    let released = false;
    // 서비스 코드는 끝나면 end()를 부름 → 풀 연결은 닫지 않고 돌려줌.
    // 배틀 서비스처럼 세션에 이름 잠금·격리 수준을 건 경우가 있어서, 돌려주기 전에 원래대로 되돌림 (실패하면 버림)
    connection.end = async () => {
      if (released) return;
      released = true;
      try {
        await connection.query('SELECT RELEASE_ALL_LOCKS()');
        await connection.query('SET SESSION transaction_isolation=@@GLOBAL.transaction_isolation');
        connection.release();
      } catch {
        connection.destroy();
      }
    };
    return connection;
  }
  const connection = await mysql.createConnection(options(config));
  await connection.query("SET time_zone='+00:00'");
  return connection;
}

// Public catalog/question reads need reusable connections that survive idle disconnects.
export async function createReadPool() {
  const pool = mysql.createPool({...options(), connectionLimit:10, maxIdle:2,
    idleTimeout:60000, waitForConnections:true, queueLimit:100,
    enableKeepAlive:true, keepAliveInitialDelay:0});
  try { await pool.query('SELECT 1'); return pool; }
  catch (error) { await pool.end(); throw error; }
}

export async function transaction(connection, action) {
  await connection.beginTransaction();
  try { const result = await action(connection); await connection.commit(); return result; }
  catch (error) { await connection.rollback(); throw error; }
}

export function safeError(error) {
  // Driver messages may contain SQL values; expose only the error category.
  return error.code || (error.message?.startsWith('MYSQL_') ? error.message : 'operation_failed');
}
