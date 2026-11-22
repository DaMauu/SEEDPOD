/* uploadMany 并发锁 / 部分失败 / 单站异常：纯临时库 + stub 目标站，不联网。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../src/infra/db');
const { makeTargetService } = require('../src/features/publish/target-service');
const uploadLock = require('../src/infra/upload-lock');
const { makeTorrent } = require('./target-mock');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-upmany-'));
const db = openDB(path.join(DATA, 'seedpod.db'));
const one = (sql, ...a) => db.prepare(sql).get(...a);
const all = (sql, ...a) => db.prepare(sql).all(...a);
const jparse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };
const now = () => new Date().toISOString();
const torrent = makeTorrent();
const results = [];

function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(c, m) { if (!c) throw new Error(m); }
function addQueue(id, data) {
  db.prepare('INSERT INTO queue(id, status, title, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?)')
    .run(id, 'approved', data.title, JSON.stringify(data), now(), now());
}
function item(id, targets) {
  return {
    id: id, title: 'Upload Many 2024 1080p', status: 'approved',
    targetSite: targets[0], targets: targets,
    prepared: { media: { kind: 'bdinfo' } },
    descrBb: '', intro: ''
  };
}
function makeService(opts) {
  const o = opts || {};
  const target = {
    resolve: function (host) { return { base: 'https://' + host, upload: {} }; },
    torrentMeta: function () { return { hash: 'hash_' + (o.hashTag || 'x'), name: 'fixture' }; },
    announceCandidates: async function (host) {
      return { ok: true, data: { candidates: [{ kind: 'generic', announce: 'https://' + host + '/announce.php' }] } };
    },
    submit: o.submit || (async function (host) {
      return { ok: true, data: { url: '', detailsUrl: '', infohash: 'hash_' + host, status: 200, message: 'ok' } };
    }),
    verify: async function () { return { ok: true, data: { found: true } }; },
    list: function () { return []; },
    detectUploadForm: async function () { return { ok: false, code: 'NO_FORM' }; },
    fetchSourceTorrent: async function () { return { err: 'fixture no source' }; }
  };
  return makeTargetService({ db: db, one: one, all: all, jparse: jparse, DATA_DIR: DATA, allowReal: function () { return true; }, logEvent: function () {} }, target);
}
const body = (id, hosts) => ({ queueId: id, targets: hosts, torrentBase64: torrent.toString('base64'), dryRun: false, preCheckDupe: false, verify: false });

(async function () {
  try {
    db.prepare("INSERT INTO meta(k, v) VALUES('config', ?)").run(JSON.stringify({ testOnly: false, allowMainTarget: true }));
    addQueue('q_lock1', item('q_lock1', ['a.example']));
    addQueue('q_lock2', item('q_lock2', ['a.example']));
    addQueue('q_part', item('q_part', ['a.example', 'b.example']));
    addQueue('q_throw', item('q_throw', ['a.example', 'b.example']));

    await check('同一队列并发提交只放行一个，结束后释放锁', async function () {
      let startedResolve = null;
      const started = new Promise(function (r) { startedResolve = r; });
      const svc = makeService({
        submit: async function (host) {
          startedResolve();
          await new Promise(function (r) { setTimeout(r, 200); });
          return { ok: true, data: { url: '', detailsUrl: '', infohash: 'hash_' + host, status: 200, message: 'ok' } };
        }
      });
      const first = svc.uploadMany(body('q_lock1', ['a.example']));
      await started;
      const second = await svc.uploadMany(body('q_lock1', ['a.example']));
      need(second.ok === false && second.code === 'UPLOAD_IN_PROGRESS' && second.http === 409, '并发没拦住：' + JSON.stringify(second));
      const done = await first;
      need(done.ok && done.data.allOk === true, '第一次提交没完成：' + JSON.stringify(done));
      const third = await svc.uploadMany(body('q_lock2', ['a.example']));
      need(third.ok && third.data.allOk === true, '释放后仍被锁：' + JSON.stringify(third));
      const free = uploadLock.acquire('q_lock1', db);
      need(free === true, '结束后锁没释放');
      uploadLock.release('q_lock1', db);
    });

    await check('一个目标失败不影响其余目标，最后释放锁', async function () {
      const svc = makeService({
        submit: async function (host) {
          if (host === 'b.example') return { ok: false, code: 'UPLOAD_REJECTED', message: '目标站拒绝' };
          return { ok: true, data: { url: '', detailsUrl: '', infohash: 'hash_' + host, status: 200, message: 'ok' } };
        }
      });
      const r = await svc.uploadMany(body('q_part', ['a.example', 'b.example']));
      need(r.ok === true && r.data.allOk === false, '部分失败结果不对：' + JSON.stringify(r.data));
      need(r.data.targets.length === 2, '目标数量不对：' + JSON.stringify(r.data.targets));
      need(r.data.targets[0].ok === true, 'a 没成功：' + JSON.stringify(r.data.targets[0]));
      need(r.data.targets[1].ok === false && r.data.targets[1].code === 'UPLOAD_REJECTED', 'b 失败没记录：' + JSON.stringify(r.data.targets[1]));
      const q = jparse(one('SELECT data FROM queue WHERE id = ?', 'q_part').data);
      need(q.targetResults['b.example'] && q.targetResults['b.example'].stage === 'failed', 'b 阶段没落库：' + JSON.stringify(q.targetResults));
      const free = uploadLock.acquire('q_part', db);
      need(free === true, '部分失败后锁没释放');
      uploadLock.release('q_part', db);
    });

    await check('单站抛异常不拖垮整批，异常记入结果并释放锁', async function () {
      const svc = makeService({
        submit: async function (host) {
          if (host === 'b.example') throw new Error('stub transport boom');
          return { ok: true, data: { url: '', detailsUrl: '', infohash: 'hash_' + host, status: 200, message: 'ok' } };
        }
      });
      const r = await svc.uploadMany(body('q_throw', ['a.example', 'b.example']));
      need(r.ok === true && r.data.allOk === false, '异常批次结果不对：' + JSON.stringify(r.data));
      need(r.data.targets[0].ok === true, '异常前目标没完成：' + JSON.stringify(r.data.targets[0]));
      const bad = r.data.targets[1];
      need(bad.ok === false && bad.code === 'UPLOAD_EXCEPTION' && /boom/.test(bad.message), '异常没记清楚：' + JSON.stringify(bad));
      const free = uploadLock.acquire('q_throw', db);
      need(free === true, '异常后锁没释放');
      uploadLock.release('q_throw', db);
    });
  } finally {
    try { db.close(); } catch (e) { /* 已关 */ }
    try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
  }
  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();
