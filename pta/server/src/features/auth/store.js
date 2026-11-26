/* 面板账号：data/auth.json，只存 scrypt 哈希，不存明文密码。
   PTA_USER / PTA_PASS 只在首次没有 auth.json 时用来初始化；之后以面板文件为准。 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jsonFile = require('../../infra/json-file');

const VERSION = 1;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 };

function validUser(user) {
  return /^[^\s\u0000-\u001F\u007F]{1,64}$/.test(String(user || ''));
}

function hashPassword(pass) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pass), salt, SCRYPT.keylen, SCRYPT);
  return { algo: 'scrypt', N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, salt: salt.toString('base64'), hash: hash.toString('base64') };
}

function verifyPassword(pass, rec) {
  if (!rec || rec.algo !== 'scrypt' || !rec.salt || !rec.hash) return false;
  try {
    const salt = Buffer.from(rec.salt, 'base64');
    const want = Buffer.from(rec.hash, 'base64');
    const got = crypto.scryptSync(String(pass), salt, want.length, { N: rec.N, r: rec.r, p: rec.p, maxmem: 64 * 1024 * 1024 });
    return got.length === want.length && crypto.timingSafeEqual(got, want);
  } catch (e) { return false; }
}

function makeAuth(DATA_DIR) {
  const FILE = path.join(DATA_DIR, 'auth.json');

  function read() {
    let doc;
    try { doc = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { return null; }
    if (!doc || doc.version !== VERSION || !validUser(doc.user)) return null;
    if (!doc.pass || doc.pass.algo !== 'scrypt' || !doc.pass.salt || !doc.pass.hash) return null;
    return doc;
  }
  function write(doc) {
    try { if (fs.existsSync(FILE)) fs.copyFileSync(FILE, FILE + '.bak'); } catch (e) { /* 备份失败不挡写入 */ }
    jsonFile.writeAtomic(FILE, doc, 0o600);
  }
  function ensureBootstrap(user, pass) {
    if (fs.existsSync(FILE)) return read();
    if (!validUser(user) || !pass) return null;
    const doc = { version: VERSION, user: String(user), pass: hashPassword(pass), updatedAt: new Date().toISOString() };
    write(doc);
    return doc;
  }
  function get() { return read(); }
  function verify(pass, doc) { return verifyPassword(pass, (doc || read() || {}).pass); }
  function update(opts) {
    const cur = read();
    if (!cur) return { ok: false, code: 'NO_ACCOUNT', message: '面板账号还不存在' };
    const user = opts && opts.user !== undefined ? String(opts.user).trim() : cur.user;
    if (!validUser(user)) return { ok: false, code: 'BAD_USER', message: '用户名不能为空、不能有空格，最多 64 字' };
    const newPass = opts && opts.newPass ? String(opts.newPass) : '';
    if (newPass && (newPass.length < 8 || newPass.length > 200)) return { ok: false, code: 'BAD_PASS', message: '新密码至少 8 位，最多 200 位' };
    const doc = { version: VERSION, user: user, pass: newPass ? hashPassword(newPass) : cur.pass, updatedAt: new Date().toISOString() };
    write(doc);
    return { ok: true, user: user, passwordChanged: !!newPass, updatedAt: doc.updatedAt };
  }
  function status() {
    if (!fs.existsSync(FILE)) return { ok: false, reason: 'NO_ACCOUNT' };
    return read() ? { ok: true } : { ok: false, reason: 'AUTH_BROKEN' };
  }

  return { FILE: FILE, get: get, status: status, ensureBootstrap: ensureBootstrap, verify: verify, update: update, validUser: validUser };
}

module.exports = makeAuth;
module.exports.makeAuth = makeAuth;
module.exports.validUser = validUser;
module.exports.hashPassword = hashPassword;
module.exports.verifyPassword = verifyPassword;
module.exports.VERSION = VERSION;
