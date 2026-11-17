/* meta.config 迁移：旧布尔/大小写归一、未知字段保留、幂等、启动升级。 */
const { DatabaseSync } = require('node:sqlite');
const schema = require('../server/config-schema');

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

check('v0 → v1：值不丢、布尔归一、host 小写', () => {
  const raw = { realCrawl: '1', realPublish: 'true', autoDupe: '0', targetHost: ' Demo-A.Example ', keepMe: { x: 1 } };
  const out = schema.migrate(raw);
  need(out.schemaVersion === 1, 'schemaVersion 不对');
  need(out.realCrawl === true && out.realPublish === true, '布尔没归一');
  need(out.autoDupe === false, 'false 没归一');
  need(out.targetHost === 'demo-a.example', 'host 没归一：' + out.targetHost);
  need(out.keepMe && out.keepMe.x === 1, '未知字段丢了');
  need(raw.autoDupe === '0', '迁移不应改原对象');
});

check('迁移幂等', () => {
  const once = schema.migrate({ realCrawl: '1', targetHost: ' A.Example ' });
  const twice = schema.migrate(once);
  need(JSON.stringify(once) === JSON.stringify(twice), '两次迁移结果不一致');
});

check('未来版本不降级', () => {
  const out = schema.migrate({ schemaVersion: 9, foo: 1 });
  need(out.schemaVersion === 9 && out.foo === 1, '未来版本被改写');
});

check('启动升级：写回并保留值', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT)');
  db.prepare('INSERT INTO meta(k,v) VALUES(?,?)').run('config', JSON.stringify({ realImages: '1', targetHost: 'DEMO-B.EXAMPLE', custom: 7 }));
  const one = (s, ...a) => db.prepare(s).get(...a);
  const ctx = { db, one };
  const out = schema.ensure(ctx);
  need(out && out.schemaVersion === 1 && out.realImages === true, 'ensure 没迁移');
  need(out.custom === 7, '自定义值丢了');
  const row = one("SELECT v FROM meta WHERE k='config'");
  const stored = JSON.parse(row.v);
  need(stored.schemaVersion === 1 && stored.custom === 7, '没写回数据库');
  db.close();
});

check('没有配置行时不凭空创建', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT)');
  const one = (s, ...a) => db.prepare(s).get(...a);
  const out = schema.ensure({ db, one });
  need(out === null, '空库不应创建配置');
  need(!one("SELECT v FROM meta WHERE k='config'"), '空库被写入配置');
  db.close();
});

const pass = results.filter(function (r) { return r[0]; }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);
