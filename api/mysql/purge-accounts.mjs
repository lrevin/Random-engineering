import { purgeExpiredAccounts } from './account-service.mjs';
import { safeError } from '../server/db.mjs';
try {console.log(JSON.stringify(await purgeExpiredAccounts()));}
catch(error){console.error(`Account cleanup failed: ${safeError(error)}`);process.exitCode=1;}