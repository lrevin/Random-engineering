import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { ROOT, loadTopics } from '../shared/question-store.mjs';

// Read the app's actual category/domain codes; exported AI topics use display names.
// TypeScript is a dev-time dependency already installed by `npm ci` in app/.
export function loadCatalog() {
  const requireApp = createRequire(path.join(ROOT, 'app/package.json'));
  const ts = requireApp('typescript');
  const dir = path.join(ROOT, 'app/src/data');
  const cache = new Map();
  function read(file) {
    file = path.resolve(file);
    if (!file.startsWith(dir + path.sep) || !file.endsWith('.ts')) throw new Error('invalid catalog module');
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, { exports, require: spec => {
      if (!spec.startsWith('./')) throw new Error('unexpected catalog dependency');
      return read(path.resolve(path.dirname(file), spec + '.ts'));
    } }, { filename: file, timeout: 5000 });
    return exports;
  }
  const app = read(path.join(dir, 'index.ts'));
  const catalog = JSON.parse(JSON.stringify({ domains: app.DOMAINS.map(d => ({ id: d.id, name: d.name })),
    categories: app.ALL_CATEGORIES.map(c => ({ id: c.id, domainId: c.domain, name: c.name })),
    topics: app.TOPICS.map(t => ({ id: t.id, categoryId: t.category, name: t.ko, difficulty: t.lv })) }));
  for (const entries of Object.values(catalog)) if (new Set(entries.map(x => x.id)).size !== entries.length) throw new Error('duplicate master code');
  const exported = loadTopics();
  if (catalog.topics.length !== Object.keys(exported).length || catalog.topics.some(t => exported[t.id]?.ko !== t.name || exported[t.id]?.lv !== t.difficulty)) {
    throw new Error('App catalog and AI topics export disagree; regenerate topics first');
  }
  return catalog;
}
