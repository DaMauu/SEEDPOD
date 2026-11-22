/* 密钥轮换：用当前 key 重新加密所有旧 key 写入的密文。
   默认只预览；加 --apply 才写库，写前自动备份 seedpod.db。
   旧 key 来源：PTA_SECRET_PREVIOUS（逗号/空白分隔）或 data/.secret.previous（一行一个）。 */
const fs = require('fs');
const path = require('path');
const { openDB } = require('../src/infra/db');
const secretbox = require('../src/infra/secretbox');

function parseArgs(argv) {
  const out = { apply: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') out.apply = true;
    else if (a === '--data') out.data = argv[++i];
    else if (a === '--db') out.db = argv[++i];
  }
  return out;
}

function decryptAny(payload, ring) {
  const s = String(payload || '');
  if (!s) return '';
  return secretbox.decrypt(s, ring);
}

function rotate(dataDir, dbFile, apply) {
  const ring = secretbox.loadKey(dataDir);
  if (!ring.ok) throw new Error('当前密钥不可用：' + (ring.reason || ring.source));
  if (!(ring.oldKeys || []).length) throw new Error('没有旧密钥：先设 PTA_SECRET_PREVIOUS 或放 data/.secret.previous');
  const file = dbFile || path.join(dataDir, 'seedpod.db');
  if (!fs.existsSync(file)) throw new Error('数据库不存在：' + file);
  if (apply) {
    const backup = file + '.bak-' + new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(file, backup);
    fs.chmodSync(backup, 0o600);
  }
  const db = openDB(file);
  const out = { credentials: 0, downloaders: 0, notify: 0, skipped: 0, backup: apply ? file + '.bak-*' : '' };
  try {
    const creds = db.prepare('SELECT host, cookie, password FROM credentials').all();
    creds.forEach(function (r) {
      const patch = {};
      ['cookie', 'password'].forEach(function (k) {
        const v = String(r[k] || '');
        if (!v) return;
        try {
          const plain = decryptAny(v, ring);
          patch[k] = secretbox.encrypt(plain, ring.key);
          out.credentials++;
        } catch (e) { out.skipped++; }
      });
      if (apply && Object.keys(patch).length) {
        db.prepare('UPDATE credentials SET cookie = ?, password = ?, updated_at = ? WHERE host = ?')
          .run(patch.cookie !== undefined ? patch.cookie : r.cookie, patch.password !== undefined ? patch.password : r.password, new Date().toISOString(), r.host);
      }
    });

    const dls = db.prepare('SELECT id, data FROM downloaders').all();
    dls.forEach(function (r) {
      let d = null;
      try { d = JSON.parse(r.data); } catch (e) { return; }
      if (!d || !d.pass) return;
      try {
        const plain = decryptAny(d.pass, ring);
        d.pass = secretbox.encrypt(plain, ring.key);
        out.downloaders++;
        if (apply) db.prepare('UPDATE downloaders SET data = ? WHERE id = ?').run(JSON.stringify(d), r.id);
      } catch (e) { out.skipped++; }
    });

    const row = db.prepare("SELECT v FROM meta WHERE k = 'config'").get();
    if (row) {
      let cfg = null;
      try { cfg = JSON.parse(row.v); } catch (e) { cfg = null; }
      if (cfg && cfg.notifyTgToken) {
        try {
          cfg.notifyTgToken = secretbox.encrypt(decryptAny(cfg.notifyTgToken, ring), ring.key);
          out.notify = 1;
          if (apply) db.prepare("INSERT INTO meta(k, v) VALUES('config', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(JSON.stringify(cfg));
        } catch (e) { out.skipped++; }
      }
    }
  } finally {
    db.close();
  }
  return out;
}

if (require.main === module) {
  const a = parseArgs(process.argv.slice(2));
  const dataDir = a.data || process.env.PTA_DATA || require('../src/infra/env').read('DATA_DIR', 'PTA_DATA') || '.';
  try {
    const r = rotate(dataDir, a.db, a.apply);
    console.log((a.apply ? '已轮换' : '预览') + '：凭据 ' + r.credentials + '、下载器 ' + r.downloaders + '、通知 ' + r.notify + '、跳过 ' + r.skipped);
    if (!a.apply) console.log('确认无误后加 --apply 写库；写前会自动备份 seedpod.db');
  } catch (e) {
    console.error('轮换失败：' + (e && e.message ? e.message : e));
    process.exit(1);
  }
}

module.exports = { rotate: rotate, parseArgs: parseArgs };
