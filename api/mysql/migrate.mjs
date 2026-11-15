import {spawn} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {databaseName, safeError} from '../server/db.mjs';

const directory = fileURLToPath(new URL('./', import.meta.url));
const configFile = fileURLToPath(new URL('./flyway.conf', import.meta.url));
const migrations = fileURLToPath(new URL('./migrations/', import.meta.url));
const commands = new Set(['migrate', 'validate', 'info', 'baseline']);

export function flywayEnvironment(database = databaseName(), environment = process.env) {
  if (!/^[a-zA-Z0-9_]{1,64}$/.test(database)) throw new Error('MYSQL_INVALID_DATABASE');
  if (!environment.MYSQL_USER) throw new Error('MYSQL_USER_REQUIRED');
  const host = environment.MYSQL_HOST || '127.0.0.1';
  const port = Number(environment.MYSQL_PORT || 3306);
  if (!/^[a-zA-Z0-9_.-]+$/.test(host) || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('MYSQL_INVALID_ADDRESS');
  const parameters = new URLSearchParams({serverTimezone: 'UTC'});
  if (environment.MYSQL_SSL_CA) {
    parameters.set('sslMode', 'VERIFY_IDENTITY');
    parameters.set('serverSslCert', environment.MYSQL_SSL_CA);
  }
  return {
    ...environment,
    FLYWAY_URL: `jdbc:mysql://${host}:${port}/${database}?${parameters}`,
    FLYWAY_USER: environment.MYSQL_USER,
    FLYWAY_PASSWORD: environment.MYSQL_PASSWORD || '',
    FLYWAY_LOCATIONS: `filesystem:${migrations.replaceAll('\\', '/')}`,
    FLYWAY_BASELINE_ON_MIGRATE: 'false',
    FLYWAY_CLEAN_DISABLED: 'true',
    FLYWAY_CREATE_SCHEMAS: 'false',
  };
}

function execute(args, env, executable = process.env.FLYWAY_EXECUTABLE || (process.platform === 'win32' ? 'flyway.cmd' : 'flyway')) {
  return new Promise((resolve, reject) => {
    const batch = process.platform === 'win32' && /\.(cmd|bat)$/i.test(executable);
    // Windows batch files need cmd.exe, but credentials stay in the environment.
    // Quote each fixed argument and reject shell expansion characters in tool paths.
    if (batch && [executable, ...args].some(value => /["\r\n%!^&|<>]/.test(value))) {
      reject(new Error('FLYWAY_UNSAFE_TOOL_PATH')); return;
    }
    const command = batch ? (process.env.ComSpec || 'cmd.exe') : executable;
    const argv = batch ? ['/d', '/s', '/c', `""${executable}" ${args.map(value => `"${value}"`).join(' ')}"`] : args;
    const child = spawn(command, argv, {cwd: directory, env, stdio: 'inherit', shell: false,
      windowsVerbatimArguments: batch, windowsHide: true});
    child.once('error', () => reject(new Error('FLYWAY_EXECUTABLE_UNAVAILABLE')));
    child.once('exit', code => code === 0 ? resolve() : reject(new Error('FLYWAY_COMMAND_FAILED')));
  });
}

export async function checkFlyway() {
  await execute(['-v'], {...process.env, FLYWAY_CONFIG_FILES: configFile});
}

export async function runFlyway(command, {database = databaseName(), baselineVersion} = {}) {
  if (!commands.has(command)) throw new Error('FLYWAY_UNSUPPORTED_COMMAND');
  if (command === 'baseline' && !['1', '2'].includes(String(baselineVersion))) throw new Error('FLYWAY_EXPLICIT_BASELINE_VERSION_REQUIRED');
  const args = [`-configFiles=${configFile}`];
  if (command === 'baseline') args.push(`-baselineVersion=${baselineVersion}`);
  args.push(command);
  await execute(args, flywayEnvironment(database));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const command = process.argv[2] || 'migrate';
    const baselineVersion = process.argv.find(arg => arg.startsWith('--baseline-version='))?.split('=')[1];
    await runFlyway(command, {baselineVersion});
  } catch (error) {
    console.error(`Migration failed: ${safeError(error)}. Set FLYWAY_EXECUTABLE or install Flyway on PATH. Existing databases are not reset.`);
    process.exitCode = 1;
  }
}
