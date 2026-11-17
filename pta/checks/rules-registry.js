/* 规则注册表：key/类型/默认值/读者齐全，旧 key 能读，服务端调用不飘。 */
const fs = require('fs');
const path = require('path');
const registry = require('../server/rule-registry');
const flowConfig = require('../server/flow-config');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server');
const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

check('注册表结构：类型/默认值/读者', () => {
  const names = registry.names();
  need(names.length >= 15, '规则太少：' + names.length);
  names.forEach((n) => {
    const r = registry.get(n);
    need(['switch', 'number', 'text'].indexOf(r.type) >= 0, n + ' 类型不对：' + r.type);
    need(r.default !== undefined, n + ' 没默认值');
    need(Array.isArray(r.readers) && r.readers.length > 0, n + ' 没读者');
    r.readers.forEach((f) => need(fs.existsSync(path.join(SERVER, f)), n + ' 的读者不存在：' + f));
  });
});

check('服务端调用的 key 都在注册表', () => {
  const files = fs.readdirSync(SERVER).filter((f) => f.endsWith('.js'));
  const missing = [];
  files.forEach((f) => {
    if (f === 'flow-config.js' || f === 'rule-registry.js') return;
    const src = fs.readFileSync(path.join(SERVER, f), 'utf8');
    const re = /flowConfig\.(?:on|onLegacy|value|number)\([^,]+,\s*'([^']+)'/g;
    let m;
    while ((m = re.exec(src))) if (!registry.get(m[1])) missing.push(f + ' → ' + m[1]);
  });
  need(!missing.length, '未注册：' + missing.join(', '));
});

check('注册表是 UI/服务端共享源，key/类型/默认值一致', () => {
  const source = path.join(ROOT, '..', registry.SOURCE);
  need(fs.existsSync(source), '共享源不存在：' + registry.SOURCE);
  const shared = JSON.parse(fs.readFileSync(source, 'utf8'));
  need(shared.version === registry.VERSION, '共享源版本不一致');
  const src = fs.readFileSync(path.join(ROOT, 'web-src', 'src', 'data', 'rules.js'), 'utf8');
  need(/from '\.\.\/\.\.\/shared\/rule-registry\.json'/.test(src), 'UI 没引用共享 JSON');
  const sandbox = { window: {}, registry: shared };
  require('vm').createContext(sandbox);
  require('vm').runInContext(src.replace(/^import .*$/m, ''), sandbox);
  const all = [];
  Object.keys(sandbox.window.PTA_RULES || {}).forEach(function (k) {
    (sandbox.window.PTA_RULES[k] || []).forEach(function (g) { (g.rows || []).forEach(function (r) { all.push(r); }); });
  });
  need(sandbox.window.PTA_RULE_REGISTRY === shared, 'UI 没挂共享注册表');
  shared.rules.forEach(function (meta) {
    const row = all.filter(function (r) { return r.t === meta.key; })[0];
    need(row, 'UI 缺 key：' + meta.key);
    if (meta.type === 'switch') {
      need(row.type === 'switch', 'UI 类型不一致：' + meta.key + ' → ' + row.type);
      need(row.on === (meta.default !== false), 'UI 默认值不一致：' + meta.key);
    } else {
      need(row.type === 'text' || row.type === 'custom', 'UI 类型不兼容：' + meta.key + ' → ' + row.type);
    }
  });
});

check('旧 key 映射到有效 key', () => {
  Object.keys(registry.ALIASES).forEach((old) => {
    need(registry.get(old), '旧 key 没映射：' + old);
    need(!registry.RULES[old], '旧 key 不该再作为主键：' + old);
  });
});

check('旧 flow 配置可读，默认值集中', () => {
  const map = flowConfig.fromSets({ fetch: [[{ t: 'qB自动种子管理', on: false }]] });
  need(map['qB 自动种子管理'], '旧 key 没归一');
  need(flowConfig.on(map, 'qB 自动种子管理', true) === false, '旧行没生效');
  need(flowConfig.on({}, '副标题拼贴') === true, '注册表默认值没生效');
  need(flowConfig.on({}, '必须有简介') === true, '默认值应以共享源为准');
  need(flowConfig.on({}, '必须有简介', false) === false, '显式默认值应覆盖共享源');
  need(flowConfig.on({}, '必须有简介', true) === true, '显式默认值应覆盖注册表');
  need(flowConfig.number({}, '图片上传重试') === 2, '数字默认值不对');
  need(flowConfig.value({}, '原盘判定关键词').indexOf('BDMV') >= 0, '文本默认值不对');
});

const pass = results.filter(function (r) { return r[0]; }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);
