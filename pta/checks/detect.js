/* 引擎识别夹具：不联网，用合成 HTML 断言 NexusPHP / UNIT3D / Gazelle / Generic。 */
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { detectEngine } = require(path.join(ROOT, 'server', 'detect.js'));

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

check('NexusPHP 识别', () => {
  const html = '<a href="takelogin.php">登录</a><a href="torrents.php">种子</a><a href="details.php?id=1">详情</a>';
  const r = detectEngine(html, 'https://x.example/torrents.php');
  need(r.engine === 'nexusphp', '识别成了 ' + r.engine);
  need(r.confidence >= 0.6, '置信度太低：' + r.confidence);
});

check('UNIT3D 识别', () => {
  const html = '<script src="/livewire/livewire.js"></script><a href="/api/v1/torrents">API</a><a href="/torrents/42">种子</a>';
  const r = detectEngine(html, 'https://x.example/torrents');
  need(r.engine === 'unit3d', '识别成了 ' + r.engine);
  need(r.confidence >= 0.6, '置信度太低：' + r.confidence);
});

check('Gazelle 识别', () => {
  const html = '<a href="ajax.php?action=index">ajax</a><a href="torrents.php?id=7">种子</a><div class="torrent_table"></div>';
  const r = detectEngine(html, 'https://x.example/torrents.php?id=7');
  need(r.engine === 'gazelle', '识别成了 ' + r.engine);
  need(r.confidence >= 0.6, '置信度太低：' + r.confidence);
});

check('特征不足走 generic，不猜', () => {
  const r = detectEngine('<html><body>hello</body></html>', 'https://x.example/');
  need(r.engine === 'generic', '不该识别成 ' + r.engine);
  need(r.confidence === 0, '置信度应为 0：' + r.confidence);
});

check('只有 URL 提示不硬判', () => {
  const r = detectEngine('', 'https://x.example/torrents.php');
  need(r.engine === 'generic', '只凭 URL 就判成了 ' + r.engine);
});

for (const [ok, name, why] of results) console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '  → ' + why));
const failed = results.filter(r => !r[0]).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
process.exit(failed ? 1 : 0);
