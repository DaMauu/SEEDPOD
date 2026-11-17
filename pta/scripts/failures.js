/* CLI：失败队列列表/重放。用法：
   node pta/scripts/failures.js [--dead] [--limit 50]
   node pta/scripts/failures.js --replay q_0001
*/
const path = require('path');
const { openDB } = require('../server/db');
const { makeFailureQueue } = require('../server/failure-queue');
const { read } = require('../server/env');

const dataDir = path.resolve(read('DATA_DIR', 'PTA_DATA') || path.join(__dirname, '..', '..', 'data'));
const db = openDB(path.join(dataDir, 'seedpod.db'));
const one = (s, ...a) => db.prepare(s).get(...a);
const all = (s, ...a) => db.prepare(s).all(...a);
const jparse = (x) => { try { return JSON.parse(x); } catch (e) { return null; } };
const q = makeFailureQueue({ db, one, all, jparse });
const argv = process.argv.slice(2);
const arg = (name, def) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; };
if (argv.includes('--replay')) {
  const r = q.replay(arg('--replay', ''));
  console.log(JSON.stringify(r, null, 2));
} else {
  console.log(JSON.stringify(q.list({ limit: arg('--limit', '50'), dead: argv.includes('--dead') }), null, 2));
}
db.close();
