/* 本地日期键：东八区凌晨要算当天，跨时区结果稳定。 */
const { spawnSync } = require('child_process');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
function run(tz, iso) {
  const r = spawnSync(process.execPath, ['-e', 'process.stdout.write(require(process.argv[1]).dayOf(Date.parse(process.argv[2])))', path.join(ROOT, 'server', 'day.js'), iso], {
    encoding: 'utf8', env: Object.assign({}, process.env, { TZ: tz })
  });
  return { code: r.status, out: String(r.stdout || '').trim(), err: String(r.stderr || '').trim() };
}
const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

check('东八区 01:30 算当天，不落到 UTC 前一天', function () {
  const r = run('Asia/Shanghai', '2026-11-21T17:30:00.000Z');
  need(r.code === 0, '子进程失败：' + r.err);
  need(r.out === '2026-11-22', '日期键不对：' + r.out);
});
check('UTC 时区同一时刻仍是前一天', function () {
  const r = run('UTC', '2026-11-21T17:30:00.000Z');
  need(r.code === 0, '子进程失败：' + r.err);
  need(r.out === '2026-11-21', '日期键不对：' + r.out);
});
check('非法时间退回当前时间，不抛异常', function () {
  const r = spawnSync(process.execPath, ['-e', 'const d=require(process.argv[1]);const v=d.dayOf("bad");process.stdout.write(/^\\d{4}-\\d{2}-\\d{2}$/.test(v)?"ok":"bad")', path.join(ROOT, 'server', 'day.js')], { encoding: 'utf8' });
  need(r.status === 0 && /ok/.test(r.stdout), '非法时间没兜底：' + (r.stderr || r.stdout));
});

const pass = results.filter(function (r) { return r[0]; }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);
