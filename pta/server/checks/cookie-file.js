/* 总 cookie 文件：迁移、存取、删除、密文与权限。纯临时目录，不联网。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../src/infra/db');
const secretbox = require('../src/infra/secretbox');
const makeCookieStore = require('../src/features/sites/credentials');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-cookiefile-'));
const db = openDB(path.join(DATA, 'seedpod.db'));
const key = secretbox.loadKey(DATA);
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(c, m) { if (!c) throw new Error(m); }

(async function () {
  try {
    db.prepare('INSERT INTO credentials(host, cookie, updated_at) VALUES(?,?,?)')
      .run('old.example', secretbox.encrypt('sid=old-secret', key.key), new Date().toISOString());
    const store = makeCookieStore(DATA);

    await check('旧 credentials 自动迁移到 cookies.json', async function () {
      const n = store.migrateFromDB(db);
      need(n === 1, '迁移数量不对：' + n);
      need(fs.existsSync(store.FILE), 'cookies.json 没生成');
      need((fs.statSync(store.FILE).mode & 0o777) === 0o600, '文件权限不是 0600');
      const text = fs.readFileSync(store.FILE, 'utf8');
      need(text.indexOf('old-secret') < 0, '文件里出现 cookie 明文');
      const c = store.get('old.example');
      need(c.cookie === 'sid=old-secret', '迁移后解不开：' + JSON.stringify(c));
      const list = store.list();
      need(list.length === 1 && list[0].host === 'old.example' && list[0].readable === true, '列表不对：' + JSON.stringify(list));
      need(store.migrateFromDB(db) === 0, '文件已存在时不该重复迁移');
    });

    await check('新增/覆盖/删除 cookie 只动文件', async function () {
      const set = store.set('new.example', 'sid=new-secret', db);
      need(set.ok && set.hasCookie === true, '保存失败：' + JSON.stringify(set));
      need(store.get('new.example').cookie === 'sid=new-secret', '新 cookie 读不出');
      const text = fs.readFileSync(store.FILE, 'utf8');
      need(text.indexOf('new-secret') < 0, '文件里出现新 cookie 明文');
      need(fs.existsSync(store.FILE + '.bak'), '覆盖前没留 .bak');
      const del = store.remove('new.example', db);
      need(del.ok && del.hasCookie === false, '删除失败：' + JSON.stringify(del));
      need(store.get('new.example').err === 'NO_COOKIE', '删除后还能读到');
      const row = db.prepare('SELECT cookie FROM credentials WHERE host = ?').get('new.example');
      need(!row, 'DB 镜像没删干净：' + JSON.stringify(row));
    });

    await check('非法 host / 超长 cookie 被拒绝', async function () {
      const a = store.set('../bad', 'sid=x', db);
      need(a.ok === false && a.code === 'BAD_HOST', '非法 host 没拦住：' + JSON.stringify(a));
      const b = store.set('ok.example', 'x'.repeat(5000), db);
      need(b.ok === false && b.code === 'BAD_REQUEST', '超长 cookie 没拦住：' + JSON.stringify(b));
    });

    await check('批量导入只保存合法项', async function () {
      const r = store.importMany([
        { host: 'a.example', cookie: 'sid=a' },
        { host: 'bad host', cookie: 'sid=x' },
        { host: 'b.example', cookie: '' }
      ], db);
      need(r.saved === 1 && r.skipped === 2, '批量导入计数不对：' + JSON.stringify(r));
      need(store.get('a.example').cookie === 'sid=a', '批量导入读不出');
    });
  } finally {
    try { db.close(); } catch (e) { /* 已关 */ }
    try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
  }
  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();
