/* 备份并发：写入进行中做一致性快照，恢复后 integrity_check 且行数合法。 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../src/infra/db');

const ROOT = path.resolve(__dirname, '..', '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-bakcc-'));
const SRC = path.join(TMP, 'src');
const DST = path.join(TMP, 'dst');
const BAK = path.join(TMP, 'snapshot.tar.gz');
fs.mkdirSync(SRC, { recursive: true });
const db = openDB(path.join(SRC, 'seedpod.db'));
db.exec('CREATE TABLE IF NOT EXISTS rows (id INTEGER PRIMARY KEY, v TEXT)');
db.close();

const childCode = `
const { openDB, tx } = require(process.env.PTA_DB_MODULE);
const db = openDB(process.env.PTA_DB_FILE);
(async function () {
  for (let i = 0; i < 80; i++) {
    tx(db, function () { db.prepare('INSERT INTO rows(v) VALUES(?)').run('row-' + i); });
    await new Promise(function (r) { setTimeout(r, 5); });
  }
  db.close();
})();
`;
(async function () {
  const child = spawn(process.execPath, ['-e', childCode], {
    env: Object.assign({}, process.env, { PTA_DB_MODULE: path.join(ROOT, 'server', 'src', 'infra', 'db.js'), PTA_DB_FILE: path.join(SRC, 'seedpod.db') }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let err = '';
  child.stderr.on('data', d => { err += d; });
  await new Promise(r => setTimeout(r, 80));
  const bak = spawnSync('bash', [path.join(ROOT, 'server', 'scripts', 'backup.sh'), SRC, BAK], { encoding: 'utf8' });
  const code = await new Promise(r => child.on('close', r));
  let restored = null, check = '';
  if (bak.status === 0) {
    const res = spawnSync('bash', [path.join(ROOT, 'server', 'scripts', 'restore.sh'), BAK, DST], { encoding: 'utf8' });
    if (res.status === 0) {
      try {
        const d = openDB(path.join(DST, 'seedpod.db'));
        restored = Number(d.prepare('SELECT COUNT(*) AS n FROM rows').get().n);
        check = String(d.prepare('PRAGMA integrity_check').get().integrity_check || '');
        d.close();
      } catch (e) { check = 'open-failed:' + (e && e.message); }
    } else check = 'restore-failed:' + (res.stderr || res.stdout);
  } else check = 'backup-failed:' + (bak.stderr || bak.stdout);
  const pass = bak.status === 0 && code === 0 && restored !== null && restored >= 0 && restored <= 80 && check === 'ok';
  console.log((pass ? 'PASS' : 'FAIL') + '  写入中备份/恢复' + (pass ? '' : '：' + JSON.stringify({ backup: bak.status, writer: code, restored: restored, check: check, err: err.slice(0, 120) })));
  console.log('\n' + (pass ? '1/1' : '0/1') + ' 通过');
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(pass ? 0 : 1);
})();
