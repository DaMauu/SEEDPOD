/* 站点映射总表：全部站点的分类/制作组对照，存在 data/site-maps.json。
   文件是事实源，网页只是编辑器；升级不覆盖，能直接手改。 */
const fs = require('fs');
const path = require('path');
const jsonFile = require('../../infra/json-file');

function fileOf(DATA_DIR) { return path.join(DATA_DIR, 'site-maps.json'); }

function readAll(DATA_DIR) {
  try {
    const j = JSON.parse(fs.readFileSync(fileOf(DATA_DIR), 'utf8'));
    return j && typeof j === 'object' && j.sites && typeof j.sites === 'object' ? j : { version: 1, sites: {} };
  } catch (e) {
    return { version: 1, sites: {} };
  }
}

function writeAll(DATA_DIR, data) {
  const file = fileOf(DATA_DIR);
  jsonFile.writeAtomic(file, data, 0o600);
}

function cleanMap(obj, max) {
  const out = {};
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
  Object.keys(obj).slice(0, max || 200).forEach(function (k) {
    const key = String(k || '').trim();
    const val = String(obj[k] == null ? '' : obj[k]).trim();
    if (key && val) out[key] = val;
  });
  return out;
}

function getHost(DATA_DIR, host) {
  const all = readAll(DATA_DIR);
  const s = all.sites[String(host || '').toLowerCase()] || {};
  return { cat: cleanMap(s.cat), team: cleanMap(s.team), raw: cleanMap(s.raw, 500), form: s.form || null, filters: s.filters || null, at: s.at || '' };
}

function setHost(DATA_DIR, host, body) {
  const h = String(host || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(h)) throw new Error('站点名不合法');
  const all = readAll(DATA_DIR);
  const next = {
    cat: cleanMap(body && body.cat),
    team: cleanMap(body && body.team)
  };
  const raw = cleanMap(body && body.raw, 500);
  if (Object.keys(raw).length) next.raw = raw;
  if (body && body.form && typeof body.form === 'object') {
    next.form = {
      at: String(body.form.at || new Date().toISOString()),
      catField: String(body.form.catField || ''),
      teamField: String(body.form.teamField || ''),
      catOptions: Array.isArray(body.form.catOptions) ? body.form.catOptions.slice(0, 300) : [],
      teamOptions: Array.isArray(body.form.teamOptions) ? body.form.teamOptions.slice(0, 300) : []
    };
  }
  if (Object.keys(next.cat).length || Object.keys(next.team).length || next.raw || next.form) next.at = new Date().toISOString();
  if (!Object.keys(next.cat).length && !Object.keys(next.team).length && !next.raw && !next.form) delete all.sites[h];
  else all.sites[h] = next;
  writeAll(DATA_DIR, all);
  return next;
}

function setFilters(DATA_DIR, host, filters) {
  const h = String(host || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(h)) throw new Error('站点名不合法');
  const all = readAll(DATA_DIR);
  const cur = all.sites[h] || {};
  cur.filters = filters && typeof filters === 'object' ? filters : {};
  cur.at = new Date().toISOString();
  all.sites[h] = cur;
  writeAll(DATA_DIR, all);
  return cur.filters;
}

function summary(DATA_DIR) {
  const all = readAll(DATA_DIR);
  const out = {};
  Object.keys(all.sites).forEach(function (h) {
    const s = all.sites[h] || {};
    out[h] = { cat: Object.keys(s.cat || {}).length, team: Object.keys(s.team || {}).length };
  });
  return out;
}

module.exports = { readAll, writeAll, getHost, setHost, setFilters, summary, fileOf, cleanMap };
