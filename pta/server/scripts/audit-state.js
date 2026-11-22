/* 只读检查 queue 的 status/stage 组合；不修数据，不改库。
   用法：node pta/scripts/audit-state.js [--data DATA_DIR] [--strict] */
const fs = require('fs');
const path = require('path');
const { openDB } = require('../src/infra/db');
const stage = require('../src/features/queue/stage');

function parseArgs(argv) {
  const out = { strict: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--strict') out.strict = true;
    else if (argv[i] === '--data') out.data = argv[++i];
  }
  return out;
}

function audit(db, opts) {
  const o = opts || {};
  const rows = db.prepare('SELECT id, status, data FROM queue').all();
  const bad = [];
  rows.forEach(function (r) {
    let d = null;
    try { d = JSON.parse(r.data); } catch (e) { d = null; }
    if (!d) { bad.push({ id: r.id, problems: ['data 不是 JSON'] }); return; }
    const it = Object.assign({}, d, { status: r.status || d.status });
    /* 旧数据没有 stage 时不报，交给 ensure 推断；strict 才要求显式 */
    if (it.stage === undefined && !o.strict) return;
    stage.ensure(it);
    const problems = stage.validate(it);
    if (problems.length) bad.push({ id: r.id, problems: problems });
  });
  return { total: rows.length, bad: bad };
}

if (require.main === module) {
  const a = parseArgs(process.argv.slice(2));
  const dir = a.data || process.env.PTA_DATA || require('../src/infra/env').read('DATA_DIR', 'PTA_DATA') || '.';
  const file = path.join(dir, 'seedpod.db');
  if (!fs.existsSync(file)) {
    console.error('数据库不存在：' + file);
    process.exit(1);
  }
  const db = openDB(file);
  let r;
  try { r = audit(db, a); } finally { db.close(); }
  console.log('queue ' + r.total + ' 条，组合不一致 ' + r.bad.length + ' 条');
  r.bad.slice(0, 20).forEach(function (x) { console.log('  ' + x.id + '：' + x.problems.join('；')); });
  process.exit(r.bad.length && a.strict ? 1 : 0);
}

module.exports = { audit: audit, parseArgs: parseArgs };
