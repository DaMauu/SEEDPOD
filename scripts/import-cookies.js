/* 从本机 Chrome（调试端口 9222）读各站 cookie，写到 pta/data/cookies.tmp.json（不入库）。
   只读 cookie 名值，不打印；下一步把这些值加密进服务端凭据。
   用法：node scripts/import-cookies.js [host1 host2 ...]（不给参数就用 site-defs 里的站） */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'pta', 'data');
const DEF = path.join(DATA, 'site-defs');
const OUT = path.join(DATA, 'cookies.tmp.json');
const PORT = Number(process.env.PTA_CDP_PORT || 9222);

function mask(h) { return h.replace(/[a-z0-9]/gi, (c, i) => (i < 2 ? c : '*')); }

(async () => {
  const { chromium } = require(path.join(process.env.TEMP || '', 'pta-shot', 'node_modules', 'playwright-core'));
  let hosts = process.argv.slice(2);
  if (!hosts.length) {
    hosts = fs.existsSync(DEF) ? fs.readdirSync(DEF).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')) : [];
  }
  if (!hosts.length) { console.log('没有要导入的站点'); return; }
  const browser = await chromium.connectOverCDP('http://127.0.0.1:' + PORT);
  const out = {};
  const report = [];
  for (const host of hosts) {
    let cookies = [];
    try { cookies = await browser.contexts()[0].cookies('https://' + host); } catch (e) { cookies = []; }
    const usable = cookies.filter(c => c && c.name && c.value);
    if (usable.length) {
      out[host] = usable.map(c => c.name + '=' + c.value).join('; ');
      report.push({ host: mask(host), cookies: usable.length, names: usable.map(c => c.name).slice(0, 6) });
    } else {
      report.push({ host: mask(host), cookies: 0, names: [] });
    }
  }
  await browser.close();
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1), { mode: 0o600 });
  console.log(JSON.stringify(report, null, 1));
  console.log('wrote ' + Object.keys(out).length + ' cookie sets to pta/data/cookies.tmp.json');
})().catch(e => { console.log('FATAL', e.message.split('\n')[0]); process.exit(1); });
