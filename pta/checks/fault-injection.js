/* 故障注入：本地 mock，不碰真实站。覆盖上传 429/500/断连/半成功/超时 + 失败队列死信/重放。 */
const http = require('http');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const imagehost = require(path.join(ROOT, 'server', 'imagehost.js'));
const { makeFailureQueue } = require(path.join(ROOT, 'server', 'failure-queue.js'));

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(() => results.push([true, name, '']))
    .catch(e => results.push([false, name, e && e.message ? e.message.split('\n')[0] : String(e)]));
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

let mode = 'ok';
const server = http.createServer((req, res) => {
  req.resume();
  req.on('end', () => {
    if (mode === 'disconnect') { req.socket.destroy(); return; }
    if (mode === '429') { res.writeHead(429, { 'content-type': 'text/plain' }); res.end('slow down'); return; }
    if (mode === '500') { res.writeHead(500, { 'content-type': 'text/plain' }); res.end('boom'); return; }
    if (mode === 'half') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok but no image url'); return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ data: { url: 'http://127.0.0.1:' + server.address().port + '/img/ok.jpg' } }));
  });
});

async function uploadFail(label) {
  const r = await imagehost.process('本地图床', [{ name: 'x.png', url: PNG }], { dryRun: false, allowReal: true, retries: 0 });
  need(!r.ok && r.failed === 1 && r.uploaded === 0, label + ' 结果不对：' + JSON.stringify({ ok: r.ok, uploaded: r.uploaded, failed: r.failed, message: r.message }));
}

async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  process.env.PTA_IMAGE_HOST_URL = 'http://127.0.0.1:' + server.address().port + '/upload';
  process.env.PTA_IMAGE_HOST_FIELD = 'file';
  delete process.env.PTA_IMAGE_HOST_TOKEN;

  await check('429 上传失败不崩溃', async () => { mode = '429'; await uploadFail('429'); });
  await check('500 上传失败不崩溃', async () => { mode = '500'; await uploadFail('500'); });
  await check('断连上传失败不崩溃', async () => { mode = 'disconnect'; await uploadFail('断连'); });
  await check('半成功响应被判失败', async () => { mode = 'half'; await uploadFail('半成功'); });
  await check('超时被判失败', async () => {
    const orig = global.fetch;
    global.fetch = () => Promise.reject(Object.assign(new Error('timeout'), { name: 'TimeoutError' }));
    try { await uploadFail('超时'); } finally { global.fetch = orig; }
  });

  await check('失败队列：死信 + 重放', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE meta(k TEXT PRIMARY KEY, v TEXT)');
    db.exec('CREATE TABLE queue(id TEXT PRIMARY KEY, status TEXT, title TEXT, data TEXT, updated_at TEXT)');
    db.prepare('INSERT INTO meta(k,v) VALUES(?,?)').run('config', JSON.stringify({ retryMax: 2 }));
    db.prepare('INSERT INTO queue(id,status,title,data,updated_at) VALUES(?,?,?,?,?)').run('q_f', 'failed', 'F', JSON.stringify({
      id: 'q_f', status: 'failed', stage: 'failed', stageFailedFrom: 'publish', stageLastErrorCode: 'TARGET_UNREACHABLE',
      stageLastError: 'timeout', retries: 2, stageUpdatedAt: new Date().toISOString()
    }), new Date().toISOString());
    const later = new Date(Date.now() + 3600000).toISOString();
    db.prepare('INSERT INTO queue(id,status,title,data,updated_at) VALUES(?,?,?,?,?)').run('q_retry', 'failed', 'R', JSON.stringify({
      id: 'q_retry', status: 'failed', stage: 'failed', stageFailedFrom: 'publish', stageLastErrorCode: 'TARGET_UNREACHABLE',
      stageLastError: 'timeout', retries: 1, nextRetryAt: later, stageUpdatedAt: new Date().toISOString()
    }), new Date().toISOString());
    const one = (s, ...a) => db.prepare(s).get(...a);
    const all = (s, ...a) => db.prepare(s).all(...a);
    const jparse = x => { try { return JSON.parse(x); } catch (e) { return null; } };
    const q = makeFailureQueue({ db, one, all, jparse });
    const list = q.list({ limit: 10 });
    need(list.total === 2 && list.items.some(x => x.id === 'q_f' && x.dead === true), '没进死信：' + JSON.stringify(list));
    need(list.items.some(x => x.id === 'q_retry' && x.dead === false && x.nextRetryAt === later), 'nextRetryAt 没保留：' + JSON.stringify(list));
    const rep = q.replay('q_f');
    need(rep.ok && rep.status === 'pending', '重放失败：' + JSON.stringify(rep));
    need(q.list({ limit: 10 }).total === 1, '重放后另一条失败应保留');
    db.close();
  });

  server.close();
  const pass = results.filter(r => r[0]).length;
  results.forEach(r => console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')));
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
}
main().catch(e => { console.error('检查脚本自身出错：' + e.message); process.exit(1); });
