import test from 'node:test';
import assert from 'node:assert/strict';
import {flywayEnvironment, runFlyway} from './migrate.mjs';

test('Flyway uses MySQL config, absolute migrations and safe execution defaults', () => {
  const env = flywayEnvironment('isolated_test', {MYSQL_USER: 'test_user', MYSQL_PASSWORD: 'test_password'});
  assert.match(env.FLYWAY_URL, /^jdbc:mysql:\/\/127\.0\.0\.1:3306\/isolated_test\?/);
  assert.equal(env.FLYWAY_PASSWORD, 'test_password');
  assert.equal(env.FLYWAY_CLEAN_DISABLED, 'true');
  assert.equal(env.FLYWAY_BASELINE_ON_MIGRATE, 'false');
  assert.equal(env.FLYWAY_CREATE_SCHEMAS, 'false');
  assert.match(env.FLYWAY_LOCATIONS, /^filesystem:.*\/api\/mysql\/migrations\//);
});
test('RDS CA settings retain hostname and certificate verification', () => {
  const env = flywayEnvironment('test', {MYSQL_HOST: 'db.example.com', MYSQL_USER: 'test', MYSQL_SSL_CA: 'C:/certs/ca file.pem'});
  const parameters = new URLSearchParams(env.FLYWAY_URL.split('?')[1]);
  assert.equal(parameters.get('sslMode'), 'VERIFY_IDENTITY');
  assert.equal(parameters.get('serverSslCert'), 'C:/certs/ca file.pem');
});
test('unsafe targets and implicit baselines are refused', async () => {
  assert.throws(() => flywayEnvironment('test;DROP', {MYSQL_USER: 'test'}), /INVALID_DATABASE/);
  assert.throws(() => flywayEnvironment('test', {}), /USER_REQUIRED/);
  assert.throws(() => flywayEnvironment('test', {MYSQL_USER: 'test', MYSQL_PORT: '-1'}), /INVALID_ADDRESS/);
  await assert.rejects(runFlyway('clean', {database: 'test'}), /UNSUPPORTED_COMMAND/);
  await assert.rejects(runFlyway('baseline', {database: 'test'}), /EXPLICIT_BASELINE/);
});
