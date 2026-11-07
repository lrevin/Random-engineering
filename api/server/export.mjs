import { loadBank, rowsFor } from '../shared/question-store.mjs';

const bank = loadBank();
const rows = rowsFor(bank);
if (process.argv.includes('--check')) {
  console.log(JSON.stringify({ topics: Object.keys(bank).length, questions: rows.length, valid: true }));
} else {
  console.error('Row JSON export has been replaced by direct MySQL import. Run npm run db:import.');
  process.exitCode = 1;
}
