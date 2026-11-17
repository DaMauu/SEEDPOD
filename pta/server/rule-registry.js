/* 规则注册表：key、类型、默认值、读者集中在一份共享 JSON。
   UI（web-src/src/data/rules.js）和服务端都读这个文件；旧 key 通过 aliases 映射。 */
const data = require('../web-src/shared/rule-registry.json');

const SOURCE = 'pta/web-src/shared/rule-registry.json';
const VERSION = Number(data.version) || 1;
const RULES = {};
(data.rules || []).forEach(function (r) {
  if (!r || !r.key) return;
  RULES[r.key] = { type: r.type, default: r.default, readers: Array.isArray(r.readers) ? r.readers : [] };
});
const ALIASES = data.aliases && typeof data.aliases === 'object' ? data.aliases : {};

function normalize(name) {
  const s = String(name == null ? '' : name).trim();
  return ALIASES[s] || s;
}
function get(name) { return RULES[normalize(name)] || null; }
function defaultOf(name) {
  const r = get(name);
  return r ? r.default : undefined;
}
function names() { return Object.keys(RULES); }

module.exports = { SOURCE, VERSION, RULES, ALIASES, normalize, get, defaultOf, names };
