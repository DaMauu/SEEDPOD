/* 单条词条状态/标记：事务内读改写，两个进程并发也不互相覆盖；缺失 id 返回 null。 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../db');
const { updCatalog } = require('../catalog-item');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-catitem-'));
const DB = path.join(DATA, 'seedpod.db');
const db = openDB(DB);
db.prepare('INSERT INTO catalog(id, site, title, status, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?)')
  .run('c_1', 'a.example', 'Item', 'new', JSON.stringify({ id: 'c_1', status: 'new', marks: {} }), '2026-11-01', '2026-11-01');
const ctx = { db: db, one: function (s, ...a) { return db.prepare(s).get(...a); }, jparse: function (s) { try { return JSON.parse(s); } catch (e) { return null; } } };
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
function worker(patch) {
  const code = `
const { openDB } = require(process.env.DBMOD);
const { updCatalog } = require(process.env.ITEMMOD);
const db = openDB(process.env.DBFILE);
const ctx = { db: db, one: function (s, ...a) { return db.prepare(s).get(...a); }, jparse: function (s) { try { return JSON.parse(s); } catch (e) { return null; } } };
const r = updCatalog(ctx, 'c_1', JSON.parse(process.env.PATCH));
process.stdout.write(JSON.stringify(r || null));
db.close();
process.exit(r ? 0 : 1);
`;
  return new Promise(function (resolve) {
    const c = spawn(process.execPath, ['-e', code], {
      env: Object.assign({}, process.env, {
        DBMOD: path.join(ROOT, 'server', 'db.js'), ITEMMOD: path.join(ROOT, 'server', 'catalog-item.js'),
        DBFILE: DB, PATCH: JSON.stringify(patch), PTA_CATALOG_TEST_DELAY_MS: '250'
      }),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let err = '';
    c.stderr.on('data', d => { err += d; });
    c.on('close', code2 => resolve({ code: code2, err: err }));
  });
}

(async function () {
  try {
    await check('状态和标记并发更新都保留', async function () {
      const both = await Promise.all([worker({ status: 'archived' }), worker({ marks: { diy: true } })]);
      need(both.every(function (x) { return x.code === 0; }), '子进程失败：' + JSON.stringify(both));
      const row = db.prepare("SELECT status, data FROM catalog WHERE id = 'c_1'").get();
      const it = JSON.parse(row.data);
      need(row.status === 'archived' && it.status === 'archived', '状态被覆盖：' + JSON.stringify({ col: row.status, data: it.status }));
      need(it.marks && it.marks.diy === true, '标记被覆盖：' + JSON.stringify(it.marks));
    });
    await check('缺失 id 返回 null 且不写数据', function () {
      const r = updCatalog(ctx, 'c_missing', { status: 'archived' });
      need(r === null, '缺失 id 没返回 null：' + JSON.stringify(r));
      need(db.prepare("SELECT COUNT(*) AS n FROM catalog WHERE id = 'c_missing'").get().n === 0, '凭空写了数据');
    });
  } finally {
    db.close();
    fs.rmSync(DATA, { recursive: true, force: true });
  }
  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();
