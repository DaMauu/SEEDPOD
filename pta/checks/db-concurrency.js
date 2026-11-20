/* SQLite 并发写：多个进程用 tx 递增，busy_timeout 保证不丢更新。 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../server/db');

const ROOT = path.resolve(__dirname, '..');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-dbcc-'));
const DB = path.join(DATA, 'seedpod.db');
const db = openDB(DB);
db.exec('CREATE TABLE IF NOT EXISTS counter (k TEXT PRIMARY KEY, n INTEGER)');
db.prepare('INSERT OR REPLACE INTO counter(k, n) VALUES(?, ?)').run('x', 0);
db.close();

const code = `
const { openDB, tx } = require(process.env.PTA_DB_MODULE);
const db = openDB(process.env.PTA_DB_FILE);
for (let i = 0; i < 25; i++) {
  tx(db, function () { db.prepare('UPDATE counter SET n = n + 1 WHERE k = ?').run('x'); });
}
db.close();
`;
function worker() {
  return new Promise(function (resolve) {
    const c = spawn(process.execPath, ['-e', code], {
      env: Object.assign({}, process.env, { PTA_DB_MODULE: path.join(ROOT, 'server', 'db.js'), PTA_DB_FILE: DB }),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let err = '';
    c.stderr.on('data', d => { err += d; });
    c.on('close', code2 => resolve({ code: code2, err: err }));
  });
}
(async function () {
  const out = await Promise.all([worker(), worker(), worker(), worker()]);
  const bad = out.filter(x => x.code !== 0);
  let n = -1;
  try {
    const check = openDB(DB);
    n = Number(check.prepare("SELECT n FROM counter WHERE k = 'x'").get().n);
    check.close();
  } catch (e) { /* 下面报错 */ }
  const pass = !bad.length && n === 100;
  console.log((pass ? 'PASS' : 'FAIL') + '  4 进程并发写 100 次' + (pass ? '' : '：' + JSON.stringify({ n: n, workers: out.map(x => x.code), err: bad[0] && bad[0].err.slice(0, 120) })));
  console.log('\n' + (pass ? '1/1' : '0/1') + ' 通过');
  fs.rmSync(DATA, { recursive: true, force: true });
  process.exit(pass ? 0 : 1);
})();
