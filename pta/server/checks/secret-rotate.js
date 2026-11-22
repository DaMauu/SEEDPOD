/* 密钥轮换：v2 key id、旧 key 解密、re-encrypt 预览/落库。纯临时目录。 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const secretbox = require('../secretbox');
const { openDB } = require('../db');
const { rotate } = require('../scripts/rotate-secret');

const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-rotate-'));
const OLD = crypto.randomBytes(32);
const NEW = crypto.randomBytes(32);
fs.writeFileSync(path.join(DATA, '.secret'), NEW.toString('hex') + '\n', { mode: 0o600 });
fs.writeFileSync(path.join(DATA, '.secret.previous'), OLD.toString('hex') + '\n', { mode: 0o600 });

(async function () {
  try {
    await check('v2 带 key id，旧 key 可解，错误 key 拒绝', async function () {
      const enc = secretbox.encrypt('hello', NEW);
      need(/^v2:[0-9a-f]{8}:/.test(enc), '不是 v2 密文：' + enc.slice(0, 12));
      const ring = { keys: [NEW, OLD] };
      need(secretbox.decrypt(enc, ring) === 'hello', '当前 key 解不开');
      const oldEnc = secretbox.encrypt('old', OLD);
      need(secretbox.decrypt(oldEnc, ring) === 'old', '旧 key 解不开');
      let rejected = false;
      try { secretbox.decrypt(enc, crypto.randomBytes(32)); } catch (e) { rejected = true; }
      need(rejected, '错误 key 没拒绝');
      const v1 = 'v1:' + Buffer.concat([crypto.randomBytes(12), crypto.randomBytes(16), Buffer.from('legacy')]).toString('base64');
      let legacyFail = false;
      try { secretbox.decrypt(v1, NEW); } catch (e) { legacyFail = true; }
      need(legacyFail, '伪造 v1 不该解开');
    });

    await check('轮换脚本：预览计数、apply 后新 key 可读', async function () {
      const dbFile = path.join(DATA, 'seedpod.db');
      const db = openDB(dbFile);
      db.prepare('INSERT INTO credentials(host, cookie, password, user, updated_at) VALUES(?, ?, ?, ?, ?)')
        .run('old.example', secretbox.encrypt('session=old', OLD), '', '', new Date().toISOString());
      db.prepare('INSERT INTO downloaders(id, data, created_at) VALUES(?, ?, ?)')
        .run('dl1', JSON.stringify({ id: 'dl1', kind: 'qb', url: 'http://127.0.0.1:1', user: 'u', pass: secretbox.encrypt('oldpass', OLD) }), new Date().toISOString());
      db.prepare("INSERT INTO meta(k, v) VALUES('config', ?)")
        .run(JSON.stringify({ notifyTgToken: secretbox.encrypt('tok', OLD) }));
      db.close();

      const preview = rotate(DATA, dbFile, false);
      need(preview.credentials === 1 && preview.downloaders === 1 && preview.notify === 1 && preview.skipped === 0, '预览计数不对：' + JSON.stringify(preview));
      const before = openDB(dbFile);
      need(/^v2:/.test(before.prepare('SELECT cookie FROM credentials WHERE host = ?').get('old.example').cookie), '预览就写库了');
      before.close();

      const applied = rotate(DATA, dbFile, true);
      need(applied.credentials === 1 && applied.downloaders === 1, 'apply 计数不对：' + JSON.stringify(applied));
      const after = openDB(dbFile);
      const ring = { keys: [NEW, OLD] };
      const cred = after.prepare('SELECT cookie FROM credentials WHERE host = ?').get('old.example');
      need(secretbox.decrypt(cred.cookie, ring) === 'session=old', '凭据轮换后读不出');
      const dl = JSON.parse(after.prepare('SELECT data FROM downloaders WHERE id = ?').get('dl1').data);
      need(secretbox.decrypt(dl.pass, ring) === 'oldpass', '下载器密码轮换后读不出');
      const cfg = JSON.parse(after.prepare("SELECT v FROM meta WHERE k = 'config'").get().v);
      need(secretbox.decrypt(cfg.notifyTgToken, ring) === 'tok', '通知 token 轮换后读不出');
      need(/^v2:/.test(cred.cookie), '凭据不是 v2');
      after.close();
    });
  } finally {
    fs.rmSync(DATA, { recursive: true, force: true });
  }
  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();
