/* 备份中断恢复：备份进程被杀后源库不坏，重新备份能恢复。 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../db');

const ROOT = path.resolve(__dirname, '..', '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-bakint-'));
const SRC = path.join(TMP, 'src');
const DST = path.join(TMP, 'dst');
const BAK1 = path.join(TMP, 'first.tar.gz');
const BAK2 = path.join(TMP, 'second.tar.gz');
fs.mkdirSync(path.join(SRC, 'site-defs'), { recursive: true });
const db = openDB(path.join(SRC, 'seedpod.db'));
db.prepare('INSERT INTO queue(id, status, title, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?)').run('q_0001', 'pending', 'interrupt', JSON.stringify({ id: 'q_0001', title: 'interrupt' }), new Date().toISOString(), new Date().toISOString());
db.close();
fs.writeFileSync(path.join(SRC, 'site-defs', 'big.bin'), Buffer.alloc(20 * 1024 * 1024, 5));

(async function () {
  const child = spawn('bash', [path.join(ROOT, 'server', 'scripts', 'backup.sh'), SRC, BAK1], { stdio: ['ignore', 'pipe', 'pipe'] });
  setTimeout(function () { try { child.kill('SIGTERM'); } catch (e) { /* 已退出 */ } }, 5);
  const code = await new Promise(r => child.on('close', r));
  let srcOk = false;
  try {
    const d = openDB(path.join(SRC, 'seedpod.db'));
    srcOk = String(d.prepare('PRAGMA integrity_check').get().integrity_check) === 'ok' && !!d.prepare('SELECT 1 FROM queue WHERE id = ?').get('q_0001');
    d.close();
  } catch (e) { srcOk = false; }
  const again = spawnSync('bash', [path.join(ROOT, 'server', 'scripts', 'backup.sh'), SRC, BAK2], { encoding: 'utf8' });
  const restore = again.status === 0 ? spawnSync('bash', [path.join(ROOT, 'server', 'scripts', 'restore.sh'), BAK2, DST], { encoding: 'utf8' }) : { status: 1, stderr: 'backup failed' };
  let dstOk = false;
  if (restore.status === 0) {
    try {
      const d = openDB(path.join(DST, 'seedpod.db'));
      dstOk = String(d.prepare('PRAGMA integrity_check').get().integrity_check) === 'ok' && !!d.prepare('SELECT 1 FROM queue WHERE id = ?').get('q_0001');
      d.close();
    } catch (e) { dstOk = false; }
  }
  const pass = srcOk && again.status === 0 && restore.status === 0 && dstOk;
  console.log((pass ? 'PASS' : 'FAIL') + '  中断后源库完好且可重新备份恢复' + (pass ? '' : '：' + JSON.stringify({ killed: code, srcOk, again: again.status, restore: restore.status, dstOk })));
  console.log('\n' + (pass ? '1/1' : '0/1') + ' 通过');
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(pass ? 0 : 1);
})();
