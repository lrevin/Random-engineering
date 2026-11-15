import {connect, databaseName, safeError} from './db.mjs';
import {checkFlyway, runFlyway} from '../mysql/migrate.mjs';

const name = databaseName();
let connection;
try {
  // Check the CLI before creating anything. DDL is applied only through Flyway.
  await checkFlyway();
  connection = await connect({database: false});
  const [[version]] = await connection.query('SELECT VERSION() AS version');
  if (!/^8\./.test(version.version)) throw new Error('MYSQL_8_REQUIRED');
  if (process.argv.includes('--existing-empty')) {
    await connection.query(`USE \`${name}\``);
    const [existing] = await connection.query('SHOW TABLES');
    if (existing.length) throw new Error('MYSQL_SCHEMA_NOT_EMPTY');
  } else {
    await connection.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
    await connection.query(`USE \`${name}\``);
  }
  await runFlyway('migrate');
  await runFlyway('validate');
  const [tables] = await connection.query('SHOW TABLES');
  console.log(JSON.stringify({database: name, version: version.version, tables: tables.length,
    businessTables: tables.filter(row => Object.values(row)[0] !== 'flyway_schema_history').length,
    migration: 'flyway', created: true}));
} catch (error) {
  console.error(`Database setup failed: ${safeError(error)}. Existing databases are not reset. A partially created NEW schema is retained for inspection.`);
  process.exitCode = 1;
} finally { await connection?.end(); }
