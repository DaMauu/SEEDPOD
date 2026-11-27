#!/usr/bin/env node
/* 读取 audit-site-detection 的 sites/*.json，生成统计和人工笔记。
   不联网、不改站点配置。 */
const fs = require('fs');
const path = require('path');

const dir = path.resolve(process.argv[2] || path.join(process.cwd(), 'data', 'site-audit'));
const sitesDir = path.join(dir, 'sites');
if (!fs.existsSync(sitesDir)) {
  console.error('没有 sites 目录：' + sitesDir);
  process.exit(2);
}
const rows = fs.readdirSync(sitesDir).filter(function (f) { return /\.json$/.test(f); }).map(function (f) {
  try { return JSON.parse(fs.readFileSync(path.join(sitesDir, f), 'utf8')); } catch (e) { return null; }
}).filter(Boolean);

function add(map, key, n) { map[key] = (map[key] || 0) + (n == null ? 1 : n); }
function top(map, limit) { return Object.keys(map).sort(function (a, b) { return map[b] - map[a]; }).slice(0, limit || 20).map(function (k) { return { key: k, count: map[k] }; }); }
const ACTIONS = {
  NO_COOKIE: '重新导入 cookie',
  LOGIN_REQUIRED: 'cookie 过期/登录失效，重新导入',
  HTTP_401: 'cookie 失效，重新登录',
  HTTP_403: '可能被 Cloudflare 拦或权限不足，单站复核',
  HTTP_404: '搜索/上传路径不对，单站改路径',
  HTTP_530: '站点异常，稍后重试',
  TIMEOUT: '请求超时，单站重试',
  FETCH_FAILED: '网络失败，单站重试',
  NO_FORM: '没有上传权限或站点未开放，先确认账号',
  UPLOAD_PATH_MISSING: '上传路径不对，单站改路径',
  UPLOAD_NO_CAT_FIELD: '没识别到分类控件，单站看 HTML',
  UPLOAD_GENRE_FIELD: '分类字段是题材，不能自动写，单站人工',
  UPLOAD_MULTI_CAT_FIELD: '主分类/子分类混在一起，单站拆分',
  UPLOAD_CHOICE_GROUP: '复选/单选组，检查选项合并',
  UPLOAD_UNMATCHED: '上传未匹配标签，按站补别名',
  SEARCH_EMPTY: '搜索分类为空，单站重识别',
  SEARCH_UNMATCHED: '搜索未识别标签，先看是否共性别名',
  SEARCH_TYPE_UNMATCHED: '搜索分类类型未识别，单站映射',
  PUBLISH_DUP: '旧发布映射重复，重识别后覆盖',
  PUBLISH_DIFF: '新旧发布映射不同，预览后写回',
  NO_BASE: '缺站点地址，单站补',
  BAD_BASE: '站点地址和域名不一致，单站修',
  PARSE_FAILED: '页面解析失败，单站看原始 HTML',
  NO_RECORD: '站点记录不存在',
  AUDIT_FAILED: '体检脚本异常，单站重跑'
};
function actionsOf(row) {
  const seen = {};
  (row.issues || []).forEach(function (x) { if (x && x.code) seen[x.code] = true; });
  return Object.keys(seen).map(function (k) { return { code: k, action: ACTIONS[k] || '单站复核' }; });
}
const status = {}, engines = {}, issueCount = {}, searchUnmatched = {}, uploadUnmatched = {};
let requests = 0, forms = 0, catForms = 0, choiceForms = 0, multiCat = 0, noForm = 0, noCat = 0, dupSites = 0, diffSites = 0;
rows.forEach(function (r) {
  add(status, r.status || 'UNKNOWN');
  add(engines, r.engine || 'unknown');
  requests += Number(r.requests) || 0;
  (r.issues || []).forEach(function (x) { add(issueCount, x.code || 'UNKNOWN'); });
  const s = r.search || {};
  if (s.ok) {
    (s.unmatched || []).forEach(function (x) { add(searchUnmatched, (x.dim || '?') + ':' + (x.label || '')); });
  }
  const u = r.upload || {};
  if (u.ok) {
    forms++;
    if (u.catFields && u.catFields.length) catForms++;
    if ((u.catFields || []).some(function (x) { return /checkbox|radio/.test(x.type); })) choiceForms++;
    if ((u.catFields || []).length > 1) multiCat++;
    if (u.savedDuplicates && u.savedDuplicates.length) dupSites++;
    if (u.diff) diffSites++;
    (u.unmatched || []).forEach(function (x) { add(uploadUnmatched, x); });
  } else if (u.code === 'NO_FORM') noForm++;
  if (u.ok && (!u.catFields || !u.catFields.length)) noCat++;
});

const actionCount = {};
const sharedSearch = {}, uniqueSearch = {}, searchSites = {};
rows.forEach(function (r) {
  actionsOf(r).forEach(function (a) { add(actionCount, a.action); });
  const s = r.search || {};
  if (!s.ok) return;
  const labels = {};
  (s.unmatched || []).forEach(function (x) {
    const key = (x.dim || '?') + ':' + (x.label || '');
    labels[key] = true;
    (searchSites[key] = searchSites[key] || []).push(r.name || r.host || '');
  });
  Object.keys(labels).forEach(function (k) { (searchSites[k].length >= 3 ? sharedSearch : uniqueSearch)[k] = (searchSites[k] || []).length; });
});

const summary = {
  at: new Date().toISOString(),
  sites: rows.length,
  requests: requests,
  status: status,
  engines: engines,
  issues: issueCount,
  upload: { forms: forms, catForms: catForms, choiceForms: choiceForms, multiCat: multiCat, noForm: noForm, noCat: noCat, savedDuplicateSites: dupSites, diffSites: diffSites },
  searchUnmatchedTop: top(searchUnmatched, 30),
  uploadUnmatchedTop: top(uploadUnmatched, 30),
  actions: top(actionCount, 30),
  sharedSearchUnmatched: top(sharedSearch, 30),
  uniqueSearchUnmatched: top(uniqueSearch, 50)
};
fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 1), { mode: 0o600 });

const order = { BLOCKED_RATE: 0, BLOCKED_LOGIN: 1, BLOCKED_COOKIE: 2, ERROR: 3, PARTIAL: 4, OK: 5 };
const sorted = rows.slice().sort(function (a, b) { return (order[a.status] == null ? 9 : order[a.status]) - (order[b.status] == null ? 9 : order[b.status]) || String(a.name || a.host).localeCompare(String(b.name || b.host)); });
const lines = [];
lines.push('# 站点识别体检');
lines.push('');
lines.push('生成时间：' + summary.at);
lines.push('');
lines.push('## 总览');
lines.push('');
lines.push('- 站点：' + summary.sites);
lines.push('- 请求：' + summary.requests + '（每站搜索页 1 次 + 上传页最多 2 次，404 才试备用路径）');
lines.push('- 上传表单：' + forms + '；分类控件：' + catForms + '；复选/单选组：' + choiceForms + '；多分类字段：' + multiCat);
lines.push('- 没有上传表单：' + noForm + '；有表单但没有分类控件：' + noCat);
lines.push('- 旧发布映射重复：' + dupSites + '；识别结果与旧映射不同：' + diffSites);
lines.push('');
lines.push('## 状态');
lines.push('');
Object.keys(status).forEach(function (k) { lines.push('- ' + k + '：' + status[k]); });
lines.push('');
lines.push('## 问题代码');
lines.push('');
Object.keys(issueCount).sort(function (a, b) { return issueCount[b] - issueCount[a]; }).forEach(function (k) { lines.push('- ' + k + '：' + issueCount[k]); });
lines.push('');
lines.push('## 建议动作');
lines.push('');
top(actionCount, 30).forEach(function (x) { lines.push('- ' + x.key + '：' + x.count); });
lines.push('');
lines.push('## 共性别名候选（≥3 个站）');
lines.push('');
top(sharedSearch, 30).forEach(function (x) { lines.push('- ' + x.key + ' × ' + x.count + ' 个站'); });
if (!Object.keys(sharedSearch).length) lines.push('- 暂无');
lines.push('');
lines.push('## 搜索未识别 TOP');
lines.push('');
top(searchUnmatched, 30).forEach(function (x) { lines.push('- ' + x.key + ' × ' + x.count); });
lines.push('');
lines.push('## 上传未匹配 TOP');
lines.push('');
top(uploadUnmatched, 30).forEach(function (x) { lines.push('- ' + x.key + ' × ' + x.count); });
lines.push('');
lines.push('## 站点明细');
lines.push('');
lines.push('| 状态 | 站点 | 引擎 | 搜索类/未识别 | 上传字段/分类选项/未匹配 | 建议动作 | 问题 |');
lines.push('| --- | --- | --- | --- | --- | --- | --- |');
sorted.forEach(function (r) {
  const s = r.search || {}; const u = r.upload || {};
  const st = s.ok && s.parsed ? s.parsed.typeCount + '/' + (s.unmatched || []).length : '-';
  const up = u.ok ? (u.fieldCount || 0) + '/' + (u.catOptions || 0) + '/' + ((u.unmatched || []).length) : '-';
  lines.push('| ' + (r.status || '') + ' | ' + String(r.name || r.host || '').replace(/\|/g, '/') + ' | ' + (r.engine || '') + ' | ' + st + ' | ' + up + ' | ' + actionsOf(r).map(function (x) { return x.action; }).join('；') + ' | ' + (r.issues || []).map(function (x) { return x.code; }).join(',') + ' |');
});
fs.writeFileSync(path.join(dir, 'summary.md'), lines.join('\n') + '\n', { mode: 0o600 });

const notes = [];
notes.push('# 识别体检笔记');
notes.push('');
notes.push('## 已确认的差异');
notes.push('');
notes.push('- 搜索分类：同一类型多个站点 ID 是站点按地区/子类拆分，不是重复 ID；需要在界面上显示原文标签。');
notes.push('- 上传分类：下拉、复选框、单选框都可能出现；同名 checkbox/radio 必须按组收集选项。');
notes.push('- 上传无表单：优先判断为账号没有上传权限或站点未开放上传，不猜字段。');
notes.push('- 旧发布映射：部分站点同一 ID 同时落两个类型，重识别后会按“一个 option 只落一个类型”修正。');
notes.push('');
notes.push('## 需要人工决定');
notes.push('');
notes.push('- 搜索未识别标签：按站点决定映射到哪个类型，或标记为不抓。');
notes.push('- 上传未匹配选项：题材/子分类/限制类标签不要硬塞进内容类型。');
notes.push('- 多分类字段：主分类和子分类要分开保存，不能简单合并成一个 catMap。');
notes.push('');
notes.push('## 下一步建议');
notes.push('');
notes.push('- 先处理 BLOCKED_LOGIN / BLOCKED_RATE / NO_FORM，避免把权限问题当解析问题。');
notes.push('- 再处理 UPLOAD_NO_CAT_FIELD / UPLOAD_UNMATCHED，按引擎和标签归类补别名。');
notes.push('- 最后处理 PUBLISH_DUP / PUBLISH_DIFF，逐站预览后写回。');
notes.push('- 原始 HTML 在 raw/ 下，只用于人工复核，不复制到仓库、不打印 cookie。');
notes.push('');
notes.push('## 本次数据');
notes.push('');
notes.push('- 请求数：' + summary.requests + '；站点数：' + summary.sites);
Object.keys(summary.status).sort(function (a, b) { return summary.status[b] - summary.status[a]; }).forEach(function (k) { notes.push('- ' + k + '：' + summary.status[k]); });
notes.push('');
notes.push('共性别名候选（≥3 个站）：');
top(sharedSearch, 20).forEach(function (x) { notes.push('- ' + x.key + ' × ' + x.count + ' 个站'); });
if (!Object.keys(sharedSearch).length) notes.push('- 暂无');
fs.writeFileSync(path.join(dir, 'notes.md'), notes.join('\n') + '\n', { mode: 0o600 });

console.log(JSON.stringify({ sites: summary.sites, requests: summary.requests, status: summary.status, out: dir }, null, 1));
