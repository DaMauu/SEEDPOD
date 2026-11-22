/* 辅种状态回写：成功/同 hash/加种失败/源种不在 qB 都要落到 targetResults.crossseed。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../db');
const { makeCrossseed } = require('../crossseed');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-crossseed-'));
const FILE = path.join(DATA, 'target.torrent');
fs.writeFileSync(FILE, 'd4:infod4:name1:x6:lengthi1eeee');
const SOURCE = 'a'.repeat(40);
const TARGET = 'b'.repeat(40);
let mode = 'success';
const qb = {
  parseTorrent: function () { return { hash: mode === 'same' ? SOURCE : TARGET }; },
  findTorrent: async function (d, hash) {
    if (mode === 'nosource' && hash === SOURCE) return { found: false };
    if (hash === SOURCE) return { found: true, progress: 1, savePath: '/dl', category: 'movie' };
    return { found: true, progress: 1, state: 'uploading', savePath: '/dl' };
  },
  addTorrent: async function () {
    if (mode === 'addfail') return { ok: false, error: 'QB_ADD_FAILED', message: 'add denied' };
    return { ok: true };
  },
  resumeTorrent: async function () { return { ok: true }; },
  trackerStatus: async function () { return { trackers: [{ working: true }] }; }
};
const db = openDB(path.join(DATA, 'seedpod.db'));
db.prepare('INSERT INTO downloaders(id, data, created_at) VALUES(?, ?, ?)')
  .run('dl_1', JSON.stringify({ id: 'dl_1', kind: 'qb', url: 'http://127.0.0.1:1' }), '2026-11-01');
const ctx = {
  db: db,
  one: function (s, ...a) { return db.prepare(s).get(...a); },
  all: function (s, ...a) { return db.prepare(s).all(...a); },
  jparse: function (s) { try { return JSON.parse(s); } catch (e) { return null; } },
  DATA_DIR: DATA,
  qb: qb
};
const crossseed = makeCrossseed(ctx);
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
function seed() {
  const data = {
    id: 'q_cs', status: 'published', stage: 'injected', infohash: SOURCE, title: 'Crossseed Row',
    targetResults: { 'a.example': { stage: 'injected', publishedTorrent: { path: FILE }, sourceTorrent: { infohash: SOURCE } } },
    targetVerify: { found: true, at: '2026-11-01T00:00:00.000Z' },
    targetVerifyByHost: { 'a.example': { found: true, at: '2026-11-01T00:00:00.000Z' } }
  };
  db.prepare('INSERT OR REPLACE INTO queue(id, status, title, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?)')
    .run(data.id, data.status, data.title, JSON.stringify(data), '2026-11-01', '2026-11-01');
  return { id: data.id, data: data };
}
function read() {
  return JSON.parse(db.prepare("SELECT data FROM queue WHERE id = 'q_cs'").get().data);
}

(async function () {
  try {
    await check('辅种成功写回 ok/targetHash，阶段不变', async function () {
      mode = 'success';
      const item = seed();
      const r = await crossseed.run(item, 'a.example');
      need(r.ok && r.targetHash === TARGET, '结果不对：' + JSON.stringify(r));
      const d = read();
      const tr = d.targetResults['a.example'];
      need(tr.stage === 'injected', '阶段被改：' + tr.stage);
      need(tr.crossseed && tr.crossseed.ok === true, 'crossseed 没写成功：' + JSON.stringify(tr.crossseed));
      need(tr.crossseed.targetHash === TARGET && tr.crossseed.error === '' && tr.crossseed.retryAt === '', '成功字段不对：' + JSON.stringify(tr.crossseed));
      need(tr.crossseed.attempts === 1, 'attempts 不对：' + tr.crossseed.attempts);
      need(d.targetVerify && d.targetVerify.found === true, 'targetVerify 被辅种改掉');
      need(d.targetVerifyByHost && d.targetVerifyByHost['a.example'].found === true, 'targetVerifyByHost 被辅种改掉');
    });

    await check('同 infohash 记成功并停止重试', async function () {
      mode = 'same';
      const item = seed();
      const r = await crossseed.run(item, 'a.example');
      need(r.ok && r.skipped === 'same_infohash', '结果不对：' + JSON.stringify(r));
      const c = read().targetResults['a.example'].crossseed;
      need(c.ok === true && c.skipped === 'same_infohash' && c.targetHash === SOURCE, '写回不对：' + JSON.stringify(c));
    });

    await check('加种失败写回错误和 retryAt', async function () {
      mode = 'addfail';
      const item = seed();
      const r = await crossseed.run(item, 'a.example');
      need(r.ok === false && r.error === 'QB_ADD_FAILED', '结果不对：' + JSON.stringify(r));
      const c = read().targetResults['a.example'].crossseed;
      need(c.ok === false && c.error === 'QB_ADD_FAILED' && c.message === 'add denied', '失败没写回：' + JSON.stringify(c));
      need(c.attempts === 1 && Date.parse(c.retryAt) > Date.now(), 'retryAt 不对：' + JSON.stringify(c));
      const d = read();
      need(d.targetVerify && d.targetVerify.found === true && d.targetVerifyByHost['a.example'].found === true, '失败时回查状态被清');
    });

    await check('源种不在 qB 记失败，重试累加 attempts', async function () {
      mode = 'nosource';
      const item = seed();
      await crossseed.run(item, 'a.example');
      const item2 = { id: 'q_cs', data: read() };
      await crossseed.run(item2, 'a.example');
      const c = read().targetResults['a.example'].crossseed;
      need(c.ok === false && c.error === 'SOURCE_NOT_IN_QB', '错误码不对：' + JSON.stringify(c));
      need(c.attempts === 2, 'attempts 没累加：' + c.attempts);
    });
  } finally {
    db.close();
    fs.rmSync(DATA, { recursive: true, force: true });
  }
  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();
