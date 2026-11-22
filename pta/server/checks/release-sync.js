/* release 阶段事务与 catalog-sync 状态一致性：纯临时库，不联网。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB, tx } = require('../src/infra/db');
const { makeRelease } = require('../release');
const catalogSync = require('../src/features/catalog/sync');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-release-'));
const db = openDB(path.join(DATA, 'seedpod.db'));
const one = (sql, ...a) => db.prepare(sql).get(...a);
const all = (sql, ...a) => db.prepare(sql).all(...a);
const jparse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };
const now = new Date().toISOString();
const ctx = { db: db, DATA_DIR: DATA, one: one, all: all, jparse: jparse, allowReal: function () { return true; } };
const release = makeRelease(ctx);
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(c, m) { if (!c) throw new Error(m); }
function addQueue(id, data, status) {
  db.prepare('INSERT INTO queue(id, status, title, data, created_at, updated_at) VALUES(?,?,?,?,?,?)')
    .run(id, status || 'pending', data.title, JSON.stringify(data), now, now);
}
function qdata(id) { const r = one('SELECT data FROM queue WHERE id = ?', id); return r ? jparse(r.data) : null; }
function addCatalog(id, data) {
  db.prepare('INSERT INTO catalog(id, status, data, created_at, updated_at) VALUES(?,?,?,?,?)')
    .run(id, data.status || 'new', JSON.stringify(data), now, now);
}
function cdata(id) { const r = one('SELECT data FROM catalog WHERE id = ?', id); return r ? jparse(r.data) : null; }

(async function () {
  try {
    addQueue('q_rel', { id: 'q_rel', title: 'Release Fixture 2024 1080p', descrBb: '简介正文', intro: '简介正文', stage: 'draft', targetSite: '' });
    addQueue('q_wait', { id: 'q_wait', title: 'Wait Retry 2024', stage: 'failed', stageFailedFrom: 'draft', stageNextRetryAt: new Date(Date.now() + 3600000).toISOString() });

    await check('prepare/preview/advance 阶段顺序一致', async function () {
      const p = release.prepare('q_rel', {});
      need(p.ok && p.data.stage === 'prepared', 'prepare 失败：' + JSON.stringify(p));
      let d = qdata('q_rel');
      need(d.stage === 'prepared' && d.prepared && d.preparedAt, 'stage/prepared 没落库：' + JSON.stringify({ s: d.stage, p: !!d.prepared }));
      const v = release.preview('q_rel');
      need(v.ok && v.data.stage === 'previewed', 'preview 失败：' + JSON.stringify(v));
      d = qdata('q_rel');
      need(d.stage === 'previewed' && d.previewedAt, 'preview 没落库：' + JSON.stringify({ s: d.stage, a: !!d.previewedAt }));
      const a = release.advance('q_rel', {});
      need(a.ok && a.data.stage === 'previewed' && a.data.next === 'target-upload / publish', 'advance 结果不对：' + JSON.stringify(a));
      need(qdata('q_rel').stage === 'previewed', 'advance 改了阶段');
    });

    await check('failed 未到重试时间只等待，不改阶段', async function () {
      const before = qdata('q_wait');
      const a = release.advance('q_wait', {});
      need(a.ok && a.data.next === 'wait', '没返回 wait：' + JSON.stringify(a));
      const after = qdata('q_wait');
      need(after.stage === 'failed' && after.stageNextRetryAt === before.stageNextRetryAt, '等待期被改：' + JSON.stringify(after));
    });

    await check('catalog-sync 状态映射与清理', async function () {
      addCatalog('c1', { id: 'c1', status: 'new', dupe: 'dupe', dupeTarget: 'x.example' });
      const item = { id: 'q_sync', catalogId: 'c1' };
      need(catalogSync.apply(ctx, item, 'rejected', '不合规') === true, 'apply rejected 失败');
      let c = cdata('c1');
      need(c.status === 'skipped' && c.queueStatus === 'rejected' && c.skipReason === '不合规' && c.skippedAt, '跳过字段不对：' + JSON.stringify(c));
      need(catalogSync.apply(ctx, item, 'approved') === true, 'apply approved 失败');
      c = cdata('c1');
      need(c.status === 'selected' && !c.skipReason && !c.skippedAt, '批准后没清跳过：' + JSON.stringify(c));
      need(catalogSync.reset(ctx, item) === true, 'reset 失败');
      c = cdata('c1');
      need(c.status === 'new' && !c.dupe && !c.dupeTarget && c.queueStatus === '', 'reset 没清干净：' + JSON.stringify(c));
    });

    await check('队列写与词条同步在同一事务回滚', async function () {
      addCatalog('c2', { id: 'c2', status: 'new' });
      addQueue('q_tx', { id: 'q_tx', title: 'Tx Fixture', catalogId: 'c2', status: 'pending' });
      catalogSync.apply(ctx, { catalogId: 'c2' }, 'approved');
      const qBefore = one('SELECT status FROM queue WHERE id = ?', 'q_tx').status;
      const cBefore = cdata('c2');
      try {
        tx(db, function () {
          db.prepare('UPDATE queue SET status = ?, updated_at = ? WHERE id = ?').run('rejected', now, 'q_tx');
          catalogSync.apply(ctx, { catalogId: 'c2' }, 'rejected', '回滚测试');
          throw new Error('boom');
        });
      } catch (e) { /* 预期回滚 */ }
      need(one('SELECT status FROM queue WHERE id = ?', 'q_tx').status === qBefore, '队列写没回滚');
      const cAfter = cdata('c2');
      need(cAfter.status === cBefore.status && cAfter.queueStatus === cBefore.queueStatus, '词条写没回滚：' + JSON.stringify(cAfter));
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
