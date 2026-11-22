/* G12 验收：两次独立 CLI 进程模拟重启，验证续跑、失败重试、不重复提交。
   不联网：失败条目缺目标站/种子，会在本地直接失败并写重试字段。 */
const { execFile } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-resume-'));
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message.split('\n')[0] : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
function run(args) {
  return new Promise(function (resolve) {
    execFile(process.execPath, [path.join(ROOT, 'server', 'src', 'cli.js')].concat(args), {
      env: Object.assign({}, process.env, { DATA_DIR: DATA, PTA_DATA: DATA }),
      timeout: 60000
    }, function (err, stdout, stderr) {
      resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}
function parse(r) { try { return JSON.parse(r.stdout); } catch (e) { return null; } }
function db() { return new DatabaseSync(path.join(DATA, 'seedpod.db')); }
function nowMinus(min) { return new Date(Date.now() - min * 60000).toISOString(); }

async function main() {
  // 第一次跑：建表 + 记录 lastRunAt
  const first = await run(['run', '--all', '--json']);
  const firstJson = parse(first);
  need(first.code === 0 && firstJson && firstJson.partial === false, '首次全链路失败：' + first.code + ' ' + first.stderr.slice(0, 200));

  // 造一条已发布条目 + 一条失败条目，打开 realPublish 让重试阶段真的跑
  const d = db();
  const ts = new Date().toISOString();
  d.prepare('INSERT INTO queue(id,status,title,data,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(
    'q_done', 'published', '已发布', JSON.stringify({
      id: 'q_done', status: 'published', stage: 'submitted',
      targetResults: { 'demo.example': { stage: 'submitted', publishedTorrent: { infohash: 'abc123' } } }
    }), ts, ts);
  d.prepare('INSERT INTO queue(id,status,title,data,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(
    'q_fail', 'failed', '待重试', JSON.stringify({
      id: 'q_fail', status: 'failed', stage: 'failed', stageFailedFrom: 'publish',
      stageLastError: '测试失败', stageLastErrorCode: 'TARGET_UNREACHABLE',
      retries: 0, nextRetryAt: nowMinus(5), updatedAt: ts
    }), ts, ts);
  d.prepare("INSERT INTO meta(k,v) VALUES('config', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")
    .run(JSON.stringify({ realPublish: true, retryMax: 2, retryBackoffMin: 15 }));
  d.close();

  // 第二次跑：模拟重启后续跑；重试阶段应尝试 q_fail，不动 q_done
  const second = await run(['run', '--all', '--json']);
  const secondJson = parse(second);
  need(second.code === 0, '重启后全链路失败：' + second.code + ' ' + second.stderr.slice(0, 200));
  need(secondJson && secondJson.steps && secondJson.steps.retry, '重启后没有 retry 结果');
  need(secondJson.steps.retry.checked >= 1, '重启后没检查失败条目：' + JSON.stringify(secondJson.steps.retry));
  need(secondJson.steps.retry.failed >= 1, '缺目标站的失败条目应重试失败：' + JSON.stringify(secondJson.steps.retry));

  const d2 = db();
  const done = JSON.parse(d2.prepare("SELECT data FROM queue WHERE id='q_done'").get().data);
  const fail = JSON.parse(d2.prepare("SELECT data FROM queue WHERE id='q_fail'").get().data);
  const qn = d2.prepare('SELECT COUNT(*) AS n FROM queue').get().n;
  const pub = d2.prepare('SELECT COUNT(*) AS n FROM published').get().n;
  const sch = JSON.parse(d2.prepare("SELECT v FROM meta WHERE k='scheduler'").get().v);
  d2.close();

  need(done.targetResults['demo.example'].publishedTorrent.infohash === 'abc123', '已发布条目的权威种子被改了');
  need(fail.retries >= 1, '失败条目没写重试次数：' + JSON.stringify(fail));
  need(fail.nextRetryAt, '失败条目没写下一次重试');
  need(qn === 2, '队列条目数变了：' + qn);
  need(pub === 0, '不应凭空写 published 表：' + pub);
  need(Number(sch.lastRunAt) > 0, '调度 lastRunAt 没更新');

  // 第三次跑：再次重启，重试次数继续推进但不重复提交已发布条目
  const third = await run(['run', '--all', '--json']);
  need(third.code === 0, '第三次全链路失败：' + third.code + ' ' + third.stderr.slice(0, 200));
  const d3 = db();
  const fail3 = JSON.parse(d3.prepare("SELECT data FROM queue WHERE id='q_fail'").get().data);
  const done3 = JSON.parse(d3.prepare("SELECT data FROM queue WHERE id='q_done'").get().data);
  const qn3 = d3.prepare('SELECT COUNT(*) AS n FROM queue').get().n;
  d3.close();
  need(fail3.retries >= fail.retries, '重试次数回退了');
  need(done3.targetResults['demo.example'].publishedTorrent.infohash === 'abc123', '重启后重复改了已发布条目');
  need(qn3 === 2, '重启后队列条目数变了：' + qn3);

  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { /* 忽略：失败不影响主流程 */ }
  results.push([true, '两次重启：续跑、重试、不重复提交', '']);
  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
}

main().catch(function (e) {
  console.error('检查脚本自身出错：' + (e && e.message ? e.message : String(e)));
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e2) { /* 忽略：失败不影响主流程 */ }
  process.exit(1);
});
