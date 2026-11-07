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

export async function connect(config = {}) {
  const connection = await mysql.createConnection(options(config));
  await connection.query("SET time_zone='+00:00'");
  return connection;
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
