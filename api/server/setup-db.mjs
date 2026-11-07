import fs from 'node:fs';
import { connect, databaseName, safeError } from './db.mjs';

const name = databaseName();
let connection;
try {
  connection = await connect({ database: false });
  const [[version]] = await connection.query('SELECT VERSION() AS version');
  if (!/^8\./.test(version.version)) throw Object.assign(new Error('MySQL 8 required'), { code: 'MYSQL_8_REQUIRED' });
  if (process.argv.includes('--existing-empty')) {
    await connection.query(`USE \`${name}\``);
    const [existing] = await connection.query('SHOW TABLES');
    if (existing.length) throw Object.assign(new Error('schema must be empty'), { code:'MYSQL_SCHEMA_NOT_EMPTY' });
  } else {
    // Deliberately no IF NOT EXISTS. A pre-existing schema is never reset.
    await connection.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
    await connection.query(`USE \`${name}\``);
  }
  const sql = fs.readFileSync(new URL('../mysql/schema-v2.sql', import.meta.url), 'utf8');
  const statements = sql.replace(/^\s*--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean);
  for (const statement of statements) await connection.query(statement);
  const [tables] = await connection.query('SHOW TABLES');
  console.log(JSON.stringify({ database: name, version: version.version, tables: tables.length, created: true }));
} catch (error) {
  console.error(`Database setup failed: ${safeError(error)}. Existing databases are not reset. A partially created NEW schema is retained for inspection.`);
  process.exitCode = 1;
} finally { await connection?.end(); }
