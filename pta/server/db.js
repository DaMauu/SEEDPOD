/* SQLite 数据层：用 Node 自带 node:sqlite，无需原生编译。
   大数据表用 JSON 列 + 少量索引列，方便从现有 JSON 文件平滑迁移；密钥类字段仍以密文列存放。 */
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

function openDB(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
    CREATE TABLE IF NOT EXISTS sites (host TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT);
    CREATE TABLE IF NOT EXISTS credentials (host TEXT PRIMARY KEY, cookie TEXT, password TEXT, user TEXT, updated_at TEXT);
    CREATE TABLE IF NOT EXISTS downloaders (id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at TEXT);
    CREATE TABLE IF NOT EXISTS catalog (
      id TEXT PRIMARY KEY, site TEXT, site_id TEXT, infohash TEXT, title TEXT,
      status TEXT, data TEXT NOT NULL, created_at TEXT, updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_catalog_status ON catalog(status);
    CREATE INDEX IF NOT EXISTS idx_catalog_site ON catalog(site);
    CREATE INDEX IF NOT EXISTS idx_catalog_hash ON catalog(infohash);
    CREATE TABLE IF NOT EXISTS queue (
      id TEXT PRIMARY KEY, status TEXT, title TEXT, data TEXT NOT NULL, created_at TEXT, updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_queue_status ON queue(status);
    CREATE TABLE IF NOT EXISTS published (id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at TEXT);
    CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, level TEXT, src TEXT, msg TEXT);
    CREATE INDEX IF NOT EXISTS idx_logs_ts ON logs(ts);
  `);
  return db;
}

function kvGet(db, k, fallback) {
  const row = db.prepare('SELECT v FROM meta WHERE k = ?').get(k);
  if (!row) return fallback;
  try { return JSON.parse(row.v); } catch (e) { return fallback; }
}
function kvSet(db, k, v) {
  db.prepare('INSERT INTO meta(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').run(k, JSON.stringify(v));
}
function jget(row) { return row && row.data ? JSON.parse(row.data) : null; }

module.exports = { openDB, kvGet, kvSet, jget };
