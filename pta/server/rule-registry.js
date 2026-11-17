/* 规则注册表：key、类型、默认值、读者集中在这里。
   服务端 flow-config 读取时统一走 normalize；旧 key 通过 ALIASES 映射到新 key，
   旧 flow 配置不需要清库。 */
const RULES = {
  '副标题拼贴': { type: 'switch', default: true, readers: ['meta-fill.js', 'release.js', 'scheduler.js'] },
  '简介回填': { type: 'switch', default: true, readers: ['meta-fill.js', 'scheduler.js'] },
  '标题原样回填': { type: 'switch', default: true, readers: ['release.js', 'scheduler.js'] },
  '必须有简介': { type: 'switch', default: false, readers: ['screen.js', 'scheduler.js'] },
  '必须有副标题': { type: 'switch', default: true, readers: ['scheduler.js'] },
  'BDInfo': { type: 'switch', default: true, readers: ['scheduler.js', 'target-upload.js'] },
  '截图至少几张': { type: 'switch', default: true, readers: ['scheduler.js', 'target-upload.js'] },
  '年份必须一致': { type: 'switch', default: true, readers: ['scheduler.js'] },
  '自动勾选标签': { type: 'switch', default: true, readers: ['target-plan.js'] },
  '默认匿名': { type: 'switch', default: false, readers: ['target-plan.js'] },
  '上传前清洗 tracker': { type: 'switch', default: true, readers: ['target-upload.js', 'target-plan.js'] },
  '发布后抓权威种子': { type: 'switch', default: true, readers: ['target-upload.js', 'target-plan.js'] },
  '辅种跳过校验': { type: 'switch', default: true, readers: ['crossseed.js', 'target-plan.js'] },
  'qB 自动种子管理': { type: 'switch', default: false, readers: ['publish.js'] },
  '图片上传重试': { type: 'number', default: 2, readers: ['routes-publish.js'] },
  '简介图片': { type: 'switch', default: true, readers: ['release.js', 'target-upload.js'] },
  '自动附加 MediaInfo': { type: 'switch', default: true, readers: ['release.js'] },
  '原盘判定关键词': { type: 'text', default: '原盘|Full Disc|BDMV|ISO', readers: ['target-service.js'] }
};

/* 旧 key / 历史写法 → 当前 key。改名时只加这里，旧配置继续能读。 */
const ALIASES = {
  'qB自动种子管理': 'qB 自动种子管理',
  '默认匿名发布': '默认匿名'
};

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

module.exports = { RULES, ALIASES, normalize, get, defaultOf, names };
