/* 从保存的站点种子页 HTML 里提取「分类名 → 分类 id」，写进 data/site-maps.json。
   不打印站名/网址；只输出站点数和分类数。默认干跑，--write 才写。 */
const fs = require('fs');
const path = require('path');
const siteMaps = require('../server/site-maps');
const { _test } = require('../server/routes-maps');
const CAT = _test.CAT;

const argv = process.argv.slice(2);
function arg(name, def) { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; }
const DIR = path.resolve(arg('--dir', '/home/ocbot/work/sitecat/done'));
const DATA = path.resolve(arg('--data', '/opt/seedpod/data'));
const WRITE = argv.includes('--write');

function decode(buf) {
  try { return new TextDecoder('utf-8', { fatal: false }).decode(buf); } catch (e) { return buf.toString('utf8'); }
}
function strip(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim();
}
function hostFromName(f) {
  const m = /^([a-z0-9][a-z0-9.-]*\.[a-z]{2,})/i.exec(String(f || ''));
  return m ? m[1].toLowerCase() : '';
}

function hostOf(html) {
  const canon = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i.exec(html) ||
    /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i.exec(html);
  if (canon) { try { return new URL(canon[1]).hostname.toLowerCase(); } catch (e) { /* ignore */ } }
  const count = {};
  const re = /href=["'](https?:\/\/[^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const u = m[1];
    try {
      const h = new URL(u).hostname.toLowerCase();
      if (/(img|pic|static|cdn|weserv|google|cloudflare|gstatic|doubanio|hdslb|aliyun|qcloud)/i.test(h)) continue;
      count[h] = (count[h] || 0) + 1;
    } catch (e) { /* ignore */ }
  }
  const top = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; })[0];
  return top || '';
}
function catsOf(html) {
  const rows = {};
  function add(id, label) {
    id = String(id || '').trim();
    label = strip(label);
    if (!/^\d+$/.test(id) || !label || label.length > 30) return;
    if (/^(请选择|全部|所有|不限|选择分类|请选择分类)$/.test(label)) return;
    const k = id;
    if (!rows[k]) rows[k] = {};
    rows[k][label] = (rows[k][label] || 0) + 1;
  }
  const are = /<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi;
  let m;
  while ((m = are.exec(html))) {
    const href = m[1].replace(/&amp;/g, '&');
    const hit = /[?&]cat=(\d+)/i.exec(href) || /[?&]cat(\d+)=1/i.exec(href);
    if (hit) add(hit[1], m[2]);
  }
  const sre = /<select\b[^>]*name=["']([^"']*(?:cat|type|category)[^"']*)["'][^>]*>([\s\S]*?)<\/select>/gi;
  while ((m = sre.exec(html))) {
    const body = m[2];
    const ore = /<option\b[^>]*value=["'](\d+)["'][^>]*>([\s\S]{0,60}?)<\/option>/gi;
    let o;
    while ((o = ore.exec(body))) add(o[1], o[2]);
  }
  const out = {};
  Object.keys(rows).forEach(function (id) {
    const best = Object.keys(rows[id]).sort(function (a, b) { return rows[id][b] - rows[id][a] || a.length - b.length; })[0];
    if (best) out[id] = { label: best, all: Object.keys(rows[id]) };
  });
  return out;
}
function canonOf(label) {
  const squeezed = String(label || '').replace(/\s+/g, '');
  for (const pair of CAT) if (pair[1].test(label) || pair[1].test(squeezed)) return pair[0];
  return '';
}

function readManifest(dir) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dir, '..', 'manifest.json'), 'utf8'));
    const arr = Array.isArray(j) ? j : (Array.isArray(j.files) ? j.files : []);
    const out = {};
    arr.forEach(function (x) {
      if (!x || !x.file) return;
      out[String(x.file)] = { host: String(x.host || '').toLowerCase(), kind: String(x.kind || ''), url: String(x.url || '') };
    });
    return out;
  } catch (e) { return {}; }
}

function readRoutes(dir) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dir, '..', 'routes.json'), 'utf8'));
    const out = {};
    (Array.isArray(j) ? j : []).forEach(function (x) {
      if (!x || !x.host) return;
      out[String(x.host).toLowerCase()] = {
        engine: String(x.engine || ''),
        browseUrl: String(x.browseUrl || ''),
        uploadUrl: String(x.uploadUrl || ''),
        browseOk: !!x.browseOk,
        uploadOk: !!x.uploadOk
      };
    });
    return out;
  } catch (e) { return {}; }
}

function main() {
  const files = fs.readdirSync(DIR).filter(function (f) { return /\.html?$/i.test(f); });
  const manifest = readManifest(DIR);
  const routes = readRoutes(DIR);
  const perHost = {};
  const rawHost = {};
  let empty = 0, noHost = 0, fromName = 0;
  for (const f of files) {
    const buf = fs.readFileSync(path.join(DIR, f));
    if (!buf.length) { empty++; continue; }
    const html = decode(buf);
    const mf = manifest[f] || null;
    let host = (mf && mf.host) || hostOf(html);
    if (!host) { host = hostFromName(f); if (host) fromName++; }
    if (!host) { noHost++; continue; }
    const cats = catsOf(html);
    if (!Object.keys(cats).length) continue;
    perHost[host] = perHost[host] || {};
    rawHost[host] = rawHost[host] || {};
    Object.keys(cats).forEach(function (id) {
      const label = cats[id].label;
      rawHost[host][id] = label;
      const cn = canonOf(label) || '其他';
      if (!perHost[host][cn]) perHost[host][cn] = id;
    });
  }
  const hosts = Object.keys(perHost);
  let catCount = 0;
  hosts.forEach(function (h) { catCount += Object.keys(perHost[h]).length; });
  console.log('文件 ' + files.length + ' · 空文件 ' + empty + ' · 认不出站点 ' + noHost);
  console.log('识别站点 ' + hosts.length + ' · 分类映射 ' + catCount + ' 条');
  if (!WRITE) { console.log('干跑，未写文件。加 --write 写入 ' + path.join(DATA, 'site-maps.json')); return; }
  const all = siteMaps.readAll(DATA);
  hosts.forEach(function (h) {
    const cur = all.sites[h] || {};
    cur.cat = Object.assign({}, perHost[h], cur.cat || {});
    cur.raw = Object.assign({}, rawHost[h] || {}, cur.raw || {});
    if (routes[h]) cur.route = Object.assign({}, routes[h], { at: new Date().toISOString() });
    cur.at = new Date().toISOString();
    all.sites[h] = cur;
  });
  siteMaps.writeAll(DATA, all);
  console.log('已写入 ' + path.join(DATA, 'site-maps.json'));
}
main();
