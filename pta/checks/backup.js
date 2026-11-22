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
fs.mkdirSync(SRC, { recursive: true });

const live = new DatabaseSync(path.join(SRC, 'seedpod.db'));
live.exec('PRAGMA journal_mode=WAL');
live.exec('CREATE TABLE queue (id TEXT PRIMARY KEY, title TEXT)');
live.prepare('INSERT INTO queue(id, title) VALUES(?, ?)').run('q_0001', 'G6 Backup Persist');
fs.writeFileSync(path.join(SRC, '.secret'), 'test-secret');
fs.writeFileSync(path.join(SRC, 'cookies.json'), '{"version":1,"cookies":{"example.org":{"cookie":"v2:fixture"}}}');
fs.writeFileSync(path.join(SRC, 'presets.json'), '{"version":1,"types":{"movie":"电影"}}');
fs.writeFileSync(path.join(SRC, 'sites.json'), '{"version":1,"sites":{"example.org":{"name":"Example"}}}');
fs.writeFileSync(path.join(SRC, 'site-urls.json'), '{"version":1,"sites":{"example.org":{"base":"b64:fixture"}}}');
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
  need(/cookies\.json/.test(names), '备份缺 cookies.json');
  need(/presets\.json/.test(names), '备份缺 presets.json');
  need(/sites\.json/.test(names), '备份缺 sites.json');
  need(/site-urls\.json/.test(names), '备份缺 site-urls.json');
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
  need(read(path.join(DST, 'cookies.json')).indexOf('v2:fixture') > 0, 'cookies.json 没恢复');
  need(read(path.join(DST, 'presets.json')).indexOf('movie') > 0, 'presets.json 没恢复');
  need(read(path.join(DST, 'sites.json')).indexOf('Example') > 0, 'sites.json 没恢复');
  need(read(path.join(DST, 'site-urls.json')).indexOf('fixture') > 0, 'site-urls.json 没恢复');
  need((fs.statSync(path.join(DST, 'seedpod.db')).mode & 0o777) === 0o600, '恢复后 db 权限不是 0600');
});

check('目标已有 db 时默认拒绝覆盖', function () {
  const r = spawnSync('bash', [path.join(ROOT, 'scripts', 'restore.sh'), BAK, DST], { encoding: 'utf8' });
  need(r.status !== 0, '已有 db 时不该成功');
  need(/FORCE=1/.test(r.stderr || r.stdout), '没有提示 FORCE=1');
});

check('大文件随备份恢复', function () {
  const big = Buffer.alloc(8 * 1024 * 1024, 7);
  fs.writeFileSync(path.join(SRC, 'library.json'), big);
  const bak2 = path.join(TMP, 'large.tar.gz');
  const dst2 = path.join(TMP, 'large-dst');
  const b = spawnSync('bash', [path.join(ROOT, 'scripts', 'backup.sh'), SRC, bak2], { encoding: 'utf8' });
  need(b.status === 0, '大文件备份失败：' + (b.stderr || b.stdout));
  const r = spawnSync('bash', [path.join(ROOT, 'scripts', 'restore.sh'), bak2, dst2], { encoding: 'utf8' });
  need(r.status === 0, '大文件恢复失败：' + (r.stderr || r.stdout));
  const got = fs.readFileSync(path.join(dst2, 'library.json'));
  need(got.length === big.length && got.equals(big), '大文件内容不一致');
});

check('FORCE=1 可以覆盖恢复', function () {
  const r = spawnSync('bash', [path.join(ROOT, 'scripts', 'restore.sh'), BAK, DST], { encoding: 'utf8', env: Object.assign({}, process.env, { FORCE: '1' }) });
  need(r.status === 0, 'FORCE 恢复失败：' + (r.stderr || r.stdout));
  const restored = new DatabaseSync(path.join(DST, 'seedpod.db'), { readOnly: true });
  const row = restored.prepare('SELECT title FROM queue WHERE id = ?').get('q_0001');
  restored.close();
  need(row && row.title === 'G6 Backup Persist', 'FORCE 恢复内容不对：' + JSON.stringify(row));
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

check('恢复到不可写目录失败，备份仍可正常恢复', function () {
  const ro = path.join(TMP, 'restore-ro');
  fs.mkdirSync(ro, { recursive: true });
  fs.chmodSync(ro, 0o500);
  const bad = spawnSync('bash', [path.join(ROOT, 'scripts', 'restore.sh'), BAK, ro], { encoding: 'utf8' });
  fs.chmodSync(ro, 0o700);
  need(bad.status !== 0, '不可写目录恢复仍成功');
  const good = path.join(TMP, 'restore-good');
  const r = spawnSync('bash', [path.join(ROOT, 'scripts', 'restore.sh'), BAK, good], { encoding: 'utf8' });
  need(r.status === 0, '备份本身不可再恢复：' + (r.stderr || r.stdout));
  const d = new DatabaseSync(path.join(good, 'seedpod.db'), { readOnly: true });
  need(d.prepare('SELECT COUNT(*) AS n FROM queue').get().n === 1, '恢复后行数不对');
  d.close();
});

check('恢复时磁盘写入上限失败，备份仍完整', function () {
  const out = path.join(TMP, 'restore-limited');
  const script = path.join(ROOT, 'scripts', 'restore.sh');
  const r = spawnSync('bash', ['-c', 'ulimit -f 1; exec bash "$0" "$1" "$2"', script, BAK, out], { encoding: 'utf8' });
  need(r.status !== 0, '恢复磁盘上限没失败');
  const good = path.join(TMP, 'restore-after-limit');
  const ok = spawnSync('bash', [script, BAK, good], { encoding: 'utf8' });
  need(ok.status === 0, '失败后备份不可恢复：' + (ok.stderr || ok.stdout));
});

check('输出目录不可写时失败且源库不受影响', function () {
  const ro = path.join(TMP, 'ro');
  fs.mkdirSync(ro, { recursive: true });
  fs.chmodSync(ro, 0o500);
  const r = spawnSync('bash', [path.join(ROOT, 'scripts', 'backup.sh'), SRC, path.join(ro, 'out.tar.gz')], { encoding: 'utf8' });
  fs.chmodSync(ro, 0o700);
  need(r.status !== 0, '不可写目录仍成功');
  const d = new DatabaseSync(path.join(SRC, 'seedpod.db'), { readOnly: true });
  need(d.prepare('SELECT COUNT(*) AS n FROM queue').get().n === 1, '源库被破坏');
  d.close();
});

check('磁盘写入上限触发失败时源库不受影响', function () {
  const out = path.join(TMP, 'full.tar.gz');
  const script = path.join(ROOT, 'scripts', 'backup.sh');
  const r = spawnSync('bash', ['-c', 'ulimit -f 1; exec bash "$0" "$1" "$2"', script, SRC, out], { encoding: 'utf8' });
  need(r.status !== 0, '磁盘上限没让备份失败');
  const d = new DatabaseSync(path.join(SRC, 'seedpod.db'), { readOnly: true });
  need(d.prepare('SELECT COUNT(*) AS n FROM queue').get().n === 1, '源库被破坏');
  d.close();
});

check('坏数据库备份不能覆盖现有数据', function () {
  const badDir = path.join(TMP, 'bad-db');
  fs.mkdirSync(badDir, { recursive: true });
  fs.writeFileSync(path.join(badDir, 'seedpod.db'), 'this is not sqlite');
  const bad = path.join(TMP, 'bad-db.tar.gz');
  const mk = spawnSync('tar', ['-czf', bad, '-C', badDir, 'seedpod.db'], { encoding: 'utf8' });
  need(mk.status === 0, '造坏库失败：' + (mk.stderr || ''));
  const keep = path.join(TMP, 'keep-db');
  fs.mkdirSync(keep, { recursive: true });
  const live2 = new DatabaseSync(path.join(keep, 'seedpod.db'));
  live2.exec('CREATE TABLE marker (v TEXT)');
  live2.prepare('INSERT INTO marker(v) VALUES(?)').run('keep-me');
  live2.close();
  const r = spawnSync('bash', [path.join(ROOT, 'scripts', 'restore.sh'), bad, keep], { encoding: 'utf8', env: Object.assign({}, process.env, { FORCE: '1' }) });
  need(r.status !== 0, '坏库恢复不该成功');
  need(/校验失败/.test(r.stderr || r.stdout), '没有提示校验失败：' + (r.stderr || r.stdout));
  const after = new DatabaseSync(path.join(keep, 'seedpod.db'), { readOnly: true });
  const row = after.prepare('SELECT v FROM marker').get();
  after.close();
  need(row && row.v === 'keep-me', '现有数据被坏库覆盖：' + JSON.stringify(row));
});

check('带符号链接的备份被拒绝', function () {
  const linkDir = path.join(TMP, 'link-dir');
  fs.mkdirSync(linkDir, { recursive: true });
  const d = new DatabaseSync(path.join(linkDir, 'seedpod.db'));
  d.exec('CREATE TABLE t (v TEXT)');
  d.close();
  fs.symlinkSync('/etc', path.join(linkDir, 'site-defs'));
  const linkBak = path.join(TMP, 'link.tar.gz');
  const mk = spawnSync('tar', ['-czf', linkBak, '-C', linkDir, 'seedpod.db', 'site-defs'], { encoding: 'utf8' });
  need(mk.status === 0, '造链接包失败：' + (mk.stderr || ''));
  const out = path.join(TMP, 'link-out');
  const r = spawnSync('bash', [path.join(ROOT, 'scripts', 'restore.sh'), linkBak, out], { encoding: 'utf8' });
  need(r.status !== 0, '带符号链接的备份不该成功');
  need(/符号链接/.test(r.stderr || r.stdout), '没有提示符号链接：' + (r.stderr || r.stdout));
});

check('缺 .secret 的备份给出警告但可恢复', function () {
  const src2 = path.join(TMP, 'src-nosecret');
  fs.mkdirSync(src2, { recursive: true });
  const d = new DatabaseSync(path.join(src2, 'seedpod.db'));
  d.exec('CREATE TABLE t (v TEXT)');
  d.close();
  const bak2 = path.join(TMP, 'nosecret.tar.gz');
  const b = spawnSync('bash', [path.join(ROOT, 'scripts', 'backup.sh'), src2, bak2], { encoding: 'utf8' });
  need(b.status === 0, '无密钥备份失败：' + (b.stderr || b.stdout));
  const out = path.join(TMP, 'nosecret-out');
  const r = spawnSync('bash', [path.join(ROOT, 'scripts', 'restore.sh'), bak2, out], { encoding: 'utf8' });
  need(r.status === 0, '无密钥备份恢复失败：' + (r.stderr || r.stdout));
  need(/\.secret/.test(r.stderr || ''), '没有提示缺 .secret：' + (r.stderr || r.stdout));
});

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* 忽略：失败不影响主流程 */ }
const pass = results.filter(function (r) { return r[0]; }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);
