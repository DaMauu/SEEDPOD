/* 总 cookie 文件：data/cookies.json，一 host 一条，AES-GCM 密文。
   面板、抓取、发布、下载器都从这里取；SQLite credentials 只作迁移回退。
   文件 0600，原子写；写入前留 .bak；不打印 cookie。 */
const fs = require('fs');
const path = require('path');
const secretbox = require('./secretbox');
const jsonFile = require('./json-file');
const uploadLock = require('./upload-lock');
const { openDB } = require('./db');

const VERSION = 1;

function makeCookieStore(dataDir) {
  const DIR = path.resolve(dataDir || '.');
  const FILE = path.join(DIR, 'cookies.json');
  const KEYRING = secretbox.loadKey(DIR);
  const keyId = function () { try { return secretbox.keyId(KEYRING.key); } catch (e) { return ''; } };
  const now = function () { return new Date().toISOString(); };
  const validHost = function (h) { return /^[a-z0-9][a-z0-9.-]*$/i.test(String(h || '')); };

  function emptyDoc() { return { version: VERSION, keyId: keyId(), cookies: {} }; }
  function readRaw() {
    try {
      const doc = JSON.parse(fs.readFileSync(FILE, 'utf8')) || {};
      const cookies = doc.cookies && typeof doc.cookies === 'object' ? doc.cookies : {};
      return { version: Number(doc.version) || VERSION, keyId: String(doc.keyId || ''), cookies: cookies };
    } catch (e) { return emptyDoc(); }
  }
  function writeDoc(doc) {
    doc.version = VERSION;
    doc.keyId = keyId();
    try {
      if (fs.existsSync(FILE)) fs.copyFileSync(FILE, FILE + '.bak');
    } catch (e) { /* 备份失败不挡写入 */ }
    jsonFile.writeAtomic(FILE, doc, 0o600);
  }
  function entryOf(doc, host) {
    const v = doc.cookies[host];
    if (!v) return null;
    if (typeof v === 'string') return { cookie: v, updatedAt: '' };
    return v;
  }
  function decrypt(enc) {
    if (!enc) return '';
    try { return secretbox.decrypt(enc, KEYRING); } catch (e) { return ''; }
  }
  function migrateFromDB(db) {
    if (fs.existsSync(FILE)) return 0;
    let rows = [];
    try { rows = db.prepare('SELECT host, cookie, updated_at FROM credentials').all(); }
    catch (e) { rows = []; }
    const doc = emptyDoc();
    rows.forEach(function (r) {
      if (!r || !r.host || !r.cookie) return;
      doc.cookies[String(r.host).toLowerCase()] = { cookie: r.cookie, updatedAt: r.updated_at || now() };
    });
    writeDoc(doc);
    return Object.keys(doc.cookies).length;
  }
  function ensureMigrated() {
    if (fs.existsSync(FILE)) return;
    let db = null;
    try { db = openDB(path.join(DIR, 'seedpod.db')); migrateFromDB(db); }
    finally { if (db) { try { db.close(); } catch (e) { /* 已关 */ } } }
  }
  function mirror(db, host, enc, at) {
    if (!db) return;
    try {
      if (enc) {
        db.prepare('INSERT INTO credentials(host, cookie, updated_at) VALUES(?, ?, ?) ON CONFLICT(host) DO UPDATE SET cookie=excluded.cookie, updated_at=excluded.updated_at')
          .run(host, enc, at || now());
      } else {
        db.prepare('DELETE FROM credentials WHERE host = ?').run(host);
      }
    } catch (e) { /* 文件已是事实源，镜像失败不挡 */ }
  }
  function get(host) {
    const h = String(host || '').toLowerCase();
    if (!validHost(h)) return { err: 'BAD_HOST' };
    ensureMigrated();
    const doc = readRaw();
    let e = entryOf(doc, h);
    if (!e) {
      /* 兼容测试/旧进程：DB 里还有但文件没有，读一次并补进文件 */
      let db = null;
      try {
        db = openDB(path.join(DIR, 'seedpod.db'));
        const row = db.prepare('SELECT cookie, updated_at FROM credentials WHERE host = ?').get(h);
        if (row && row.cookie) {
          doc.cookies[h] = { cookie: row.cookie, updatedAt: row.updated_at || now() };
          writeDoc(doc);
          e = doc.cookies[h];
        }
      } catch (err) { /* 没有旧数据 */ }
      finally { if (db) { try { db.close(); } catch (err) { /* 已关 */ } } }
    }
    if (!e) return { err: 'NO_COOKIE' };
    const cookie = decrypt(e.cookie);
    if (!cookie) return { err: 'COOKIE_UNREADABLE' };
    return { cookie: cookie, updatedAt: e.updatedAt || '' };
  }
  function has(host) {
    const h = String(host || '').toLowerCase();
    try { return !!get(h).cookie; } catch (e) { return false; }
  }
  function list() {
    ensureMigrated();
    const doc = readRaw();
    return Object.keys(doc.cookies).map(function (h) {
      const e = doc.cookies[h] || {};
      const enc = typeof e === 'string' ? e : e.cookie;
      return { host: h, hasCookie: !!enc, readable: !!decrypt(enc), updatedAt: e.updatedAt || null };
    }).filter(function (x) { return x.hasCookie; });
  }
  function set(host, cookie, db) {
    const h = String(host || '').toLowerCase();
    if (!validHost(h)) return { ok: false, code: 'BAD_HOST', message: '站点域名不合法' };
    const val = String(cookie == null ? '' : cookie).trim();
    if (val.length > 4096) return { ok: false, code: 'BAD_REQUEST', message: 'cookie 太长' };
    if (val && KEYRING.ok === false) return { ok: false, code: 'CRYPTO_UNAVAILABLE', message: '凭据密钥不可用：检查 SECRET_FILE/SECRET' };
    const lock = db ? uploadLock.acquire('cookies', db) : true;
    if (!lock) return { ok: false, code: 'COOKIE_BUSY', message: 'cookie 正在写入，稍后再试' };
    try {
      ensureMigrated();
      const doc = readRaw();
      if (!val) {
        delete doc.cookies[h];
        writeDoc(doc);
        mirror(db, h, '');
        return { ok: true, hasCookie: false };
      }
      const enc = secretbox.encrypt(val, KEYRING.key);
      doc.cookies[h] = { cookie: enc, updatedAt: now() };
      writeDoc(doc);
      mirror(db, h, enc);
      return { ok: true, hasCookie: true };
    } finally { if (db) uploadLock.release('cookies', db); }
  }
  function remove(host, db) { return set(host, '', db); }
  function importMany(items, db) {
    const listIn = Array.isArray(items) ? items : [];
    let saved = 0, skipped = 0;
    listIn.slice(0, 200).forEach(function (it) {
      const h = String((it && it.host) || '').trim().toLowerCase();
      const c = String((it && it.cookie) || '').trim();
      if (!h || !validHost(h) || !c || c.length > 4096) { skipped++; return; }
      const r = set(h, c, db);
      if (r.ok) saved++; else skipped++;
    });
    return { saved: saved, skipped: skipped };
  }
  return { FILE: FILE, get: get, has: has, list: list, set: set, remove: remove, importMany: importMany, migrateFromDB: migrateFromDB, keyId: keyId };
}

module.exports = makeCookieStore;
module.exports.makeCookieStore = makeCookieStore;
module.exports.VERSION = VERSION;
