/* 备份/恢复夹具：临时数据目录，不碰真实 /data。 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-backup-'));
const SRC = path.join(TMP, 'src');
const DST = path.join(TMP, 'dst');
const BAK = path.join(TMP, 'backup.tar.gz');
const results = [];

function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
function read(file) { return fs.readFileSync(file, 'utf8'); }

fs.mkdirSync(path.join(SRC, 'site-defs'), { recursive: true });
const live = new DatabaseSync(path.join(SRC, 'seedpod.db'));
live.exec('PRAGMA journal_mode=WAL');
live.exec('CREATE TABLE queue (id TEXT PRIMARY KEY, title TEXT)');
live.prepare('INSERT INTO queue(id, title) VALUES(?, ?)').run('q_0001', 'G6 Backup Persist');
fs.writeFileSync(path.join(SRC, '.secret'), 'test-secret');
fs.writeFileSync(path.join(SRC, 'site-pack.json'), '{"sites":{"example.org":{"catMap":{"movie":"1"}}}}');
fs.writeFileSync(path.join(SRC, 'site-defs', 'example.org.json'), '{"engine":"nexusphp"}');
fs.writeFileSync(path.join(SRC, 'events.log'), 'should-not-be-in-backup');

check('备份包含 db/密钥/私有站点，不含日志', function () {
  const r = spawnSync('bash', [path.join(ROOT, 'scripts', 'backup.sh'), SRC, BAK], { encoding: 'utf8' });
  need(r.status === 0, '备份失败：' + (r.stderr || r.stdout));
  need(fs.existsSync(BAK), '备份文件没生成');
  live.close();
  need((fs.statSync(BAK).mode & 0o777) === 0o600, '备份权限不是 0600');
  const list = spawnSync('tar', ['-tzf', BAK], { encoding: 'utf8' });
  need(list.status === 0, '读备份失败');
  const names = list.stdout;
  need(/seedpod\.db/.test(names), '备份缺 seedpod.db');
  need(/\.secret/.test(names), '备份缺 .secret');
  need(/site-defs\/example\.org\.json/.test(names), '备份缺私有站点定义');
  need(!/events\.log/.test(names), '备份不该带 events.log');
});

check('恢复到空目录并校验内容', function () {
  const r = spawnSync('bash', [path.join(ROOT, 'scripts', 'restore.sh'), BAK, DST], { encoding: 'utf8' });
  need(r.status === 0, '恢复失败：' + (r.stderr || r.stdout));
  const restored = new DatabaseSync(path.join(DST, 'seedpod.db'), { readOnly: true });
  const row = restored.prepare('SELECT title FROM queue WHERE id = ?').get('q_0001');
  restored.close();
  need(row && row.title === 'G6 Backup Persist', 'db/WAL 内容不对：' + JSON.stringify(row));
  need(read(path.join(DST, '.secret')) === 'test-secret', '密钥内容不对');
  need(read(path.join(DST, 'site-pack.json')).indexOf('example.org') > 0, '私有包内容不对');
  need(read(path.join(DST, 'site-defs', 'example.org.json')).indexOf('nexusphp') > 0, '站点定义内容不对');
  need((fs.statSync(path.join(DST, 'seedpod.db')).mode & 0o777) === 0o600, '恢复后 db 权限不是 0600');
});

check('目标已有 db 时默认拒绝覆盖', function () {
  const r = spawnSync('bash', [path.join(ROOT, 'scripts', 'restore.sh'), BAK, DST], { encoding: 'utf8' });
  need(r.status !== 0, '已有 db 时不该成功');
  need(/FORCE=1/.test(r.stderr || r.stdout), '没有提示 FORCE=1');
});

check('越界路径备份被拒绝', function () {
  const bad = path.join(TMP, 'bad.tar.gz');
  const badDir = path.join(TMP, 'bad');
  fs.mkdirSync(badDir, { recursive: true });
  fs.writeFileSync(path.join(badDir, 'seedpod.db'), 'x');
  // 用系统 tar 造一个 ../evil 条目，验证恢复脚本的路径检查
  const mk = spawnSync('tar', ['-czf', bad, '-C', badDir, '--transform=s|seedpod.db|../seedpod.db|', 'seedpod.db'], { encoding: 'utf8' });
  if (mk.status !== 0) throw new Error('造坏包失败：' + (mk.stderr || ''));
  const out = path.join(TMP, 'bad-out');
  const r = spawnSync('bash', [path.join(ROOT, 'scripts', 'restore.sh'), bad, out], { encoding: 'utf8' });
  need(r.status !== 0, '越界备份不该成功');
  need(/越界/.test(r.stderr || r.stdout), '没有提示越界');
});

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* 忽略：失败不影响主流程 */ }
const pass = results.filter(function (r) { return r[0]; }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);
