/* 把人工保存的网页源码吃进样本库：你在浏览器里「另存为 → 网页，仅 HTML」存下来的文件，
   放进 pta/data/manual/，文件名用站点域名（例如 example.org.html），跑这一条就完成
   入样 → 重新分析 → 重建站点定义与预设 → 校验 → 覆盖率。
   用法：node scripts/ingest-manual.js [--no-pipeline] [--dir 目录] */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'pta', 'data');
const SAMPLES = path.join(DATA, 'samples');
const STATE = path.join(SAMPLES, '_state.json');
const argv = process.argv.slice(2);
const noPipeline = argv.indexOf('--no-pipeline') >= 0;
const dirArg = argv.indexOf('--dir');
const MANUAL = dirArg >= 0 && argv[dirArg + 1] ? path.resolve(ROOT, argv[dirArg + 1]) : path.join(DATA, 'manual');
const DONE = path.join(MANUAL, 'done');

function readJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; } }
function isHost(s) { return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(s); }

/* 站点清单（域名 + 书签标题），给「文件名不是域名」的存档认站用 */
const SITE_KEY = (function () {
  const out = [];
  const seen = {};
  (readJson(path.join(DATA, 'sites-bookmark.local.json'), []) || []).forEach(function (x) {
    if (!/内站|外站/.test(x.path || '')) return;          /* 书签里还有豆瓣/IMDb 这类，别当站点 */
    const h = String(x.url || '').replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./i, '').toLowerCase();
    if (!h || seen[h]) return;
    seen[h] = 1;
    out.push({ host: h, title: String(x.title || '') });
  });
  try {
    fs.readFileSync(path.join(DATA, 'site-arch.local.csv'), 'utf8').split(/\r?\n/).slice(1).forEach(function (l) {
      const h = String(l.split(',')[0] || '').trim().toLowerCase();
      if (h && !seen[h]) { seen[h] = 1; out.push({ host: h, title: '' }); }
    });
  } catch (e) {}
  return out;
})();
const siteid = require(path.join(ROOT, 'server', 'adapters', 'siteid.js'));

fs.mkdirSync(MANUAL, { recursive: true });
fs.mkdirSync(DONE, { recursive: true });
fs.mkdirSync(SAMPLES, { recursive: true });
const state = readJson(STATE, {});

let files = [];
try {
  files = fs.readdirSync(MANUAL).filter(function (f) {
    return /\.(html?|htm)$/i.test(f) && fs.statSync(path.join(MANUAL, f)).isFile();
  });
} catch (e) { files = []; }

if (!files.length) {
  console.log('没有待处理文件。把浏览器「另存为 → 网页，仅 HTML」的文件放进：' + path.relative(ROOT, MANUAL));
  console.log('文件名用域名，例如 example.org.html');
  process.exit(0);
}

const ok = [], skipped = [];
for (const f of files) {
  const full = path.join(MANUAL, f);
  let html = '';
  try { html = fs.readFileSync(full, 'utf8'); } catch (e) { skipped.push(f + '：读不了'); continue; }
  if (html.length < 500) { skipped.push(f + '：文件太小（' + html.length + ' 字节）'); continue; }

  /* 域名优先取文件名；文件名是页面标题时，按页面自链域名/书签标题/域名首段认站 */
  let host = f.replace(/\.(html?|htm)$/i, '').trim().toLowerCase();
  let matched = '';
  let ignored = '';
  if (!isHost(host)) {
    /* 中文别名这类人工兜底：pta/data/manual/aliases.json 形如 {"猪猪":"piggo.me"} */
    const aliases = readJson(path.join(DATA, 'manual', 'aliases.json'), {}) || {};
    for (const key of Object.keys(aliases)) {
      if (f.indexOf(key) >= 0) {
        const v = String(aliases[key] || '').toLowerCase();
        if (!v) { ignored = key; break; }                        /* 别名配空串＝不是站点，跳过 */
        host = v; matched = 'alias:' + key; break;
      }
    }
  }
  if (!isHost(host)) {
    const hit = siteid.identify(html, f, SITE_KEY);
    if (hit) { host = hit.host; matched = hit.why; }
  }
  if (ignored) { skipped.push(f + '：按别名忽略（' + ignored + '）'); continue; }
  if (!isHost(host)) {
    const m2 = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i.exec(html)
      || /<base[^>]+href=["']([^"']+)/i.exec(html)
      || /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)/i.exec(html);
    if (m2) {
      try { host = new URL(m2[1], 'https://x/').hostname.replace(/^www\./, '').toLowerCase(); } catch (e) {}
    }
  }
  if (!isHost(host)) { skipped.push(f + '：认不出域名（文件名不是域名，页面里也没有自链）'); continue; }

  fs.writeFileSync(path.join(SAMPLES, host + '.html.gz'), zlib.gzipSync(Buffer.from(html, 'utf8')));
  state[host] = {
    host: host, arch: (state[host] && state[host].arch) || '?',
    url: 'manual://' + host, at: new Date().toISOString(),
    status: 200, bytes: html.length, note: 'manual', tries: 1, match: matched
  };
  ok.push(host);
  try { fs.renameSync(full, path.join(DONE, f)); } catch (e) {}
}
fs.writeFileSync(STATE, JSON.stringify(state, null, 1), 'utf8');

console.log('吃进 ' + ok.length + ' 份人工源码' + (ok.length ? '：' + ok.slice(0, 8).join(' ') + (ok.length > 8 ? ' …' : '') : ''));
if (skipped.length) skipped.forEach(function (s) { console.log('  跳过 ' + s); });

if (!ok.length || noPipeline) process.exit(0);

const run = function (script, args) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', script)].concat(args || []), { cwd: ROOT, stdio: 'inherit' });
  return r.status === 0;
};
run('analyze-samples.js', ['--quiet']);
run('collect-site-defs.js', []);
run('validate-defs.js', []);
run('coverage.js', []);
console.log('完成：定义与预设已更新，发到测试机后刷新面板就能看到。');
