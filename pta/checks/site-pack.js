/* 站点包检查：加密/解密、篡改、缺密钥、私钥错误、密文无明文 host、生成器 dry-run。 */
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const secretbox = require('../server/secretbox');
const sitePack = require('../server/site-pack');

const ROOT = path.resolve(__dirname, '..');
const KEY = crypto.randomBytes(32).toString('hex');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-pack-'));
const DEF = path.join(TMP, 'site-defs');
const ENC = path.join(TMP, 'pack', 'site-pack.enc');
const REPORT = path.join(TMP, 'exceptions.json');
const results = [];

function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
function run(args, env) {
  return spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-site-pack.js')].concat(args), {
    env: Object.assign({}, process.env, env || {}), encoding: 'utf8'
  });
}

fs.mkdirSync(DEF, { recursive: true });
fs.writeFileSync(path.join(DEF, 'a.example.json'), JSON.stringify({
  host: 'a.example', base: 'https://a.example', engine: 'nexusphp',
  searchPath: '/torrents.php', params: { search: '{q}', cat: '{cats}' }, catMode: 'single',
  catMap: [{ id: '401', label: '电影', purpose: 'movie' }, { id: '402', label: 'Documentary', purpose: 'other' }],
  uploadMap: { path: '/takeupload.php', formPath: '/upload.php', fileField: 'file', fields: { name: '{title}' } }
}, null, 2));
fs.writeFileSync(path.join(DEF, 'b.example.json'), JSON.stringify({
  host: 'b.example', base: 'https://b.example', engine: 'nexusphp',
  catMap: [{ id: '9', label: 'Unknown Thing', purpose: 'other' }]
}, null, 2));

check('生成器 dry-run 出覆盖率且不打印站名', function () {
  const r = run(['--data', TMP, '--dry', '--report', REPORT]);
  need(r.status === 0, '退出码 ' + r.status + ' ' + (r.stderr || ''));
  need(/自动匹配/.test(r.stdout), '没有覆盖率输出');
  need(r.stdout.indexOf('a.example') < 0 && r.stdout.indexOf('b.example') < 0, '控制台出现了站名');
  need(fs.existsSync(REPORT), '例外清单没写');
});

check('生成加密包且密文不含明文 host', function () {
  const r = run(['--data', TMP, '--out', ENC], { PTA_SITE_PACK_KEY: KEY });
  need(r.status === 0, '生成失败：' + (r.stderr || r.stdout));
  need(fs.existsSync(ENC), '密文没写');
  const raw = fs.readFileSync(ENC, 'utf8');
  need(raw.indexOf('a.example') < 0 && raw.indexOf('b.example') < 0, '密文里能看到明文站名');
  need(raw.slice(0, 3) === 'v1:', '不是 v1 密文');
});

check('解密、分类自动匹配和上传映射', function () {
  const r = sitePack.load({ file: ENC, key: KEY });
  need(r.ok, '解密失败：' + r.reason);
  need(Object.keys(r.pack.sites).length === 2, '站点数不对');
  const a = sitePack.siteOf('a.example', { file: ENC, key: KEY });
  need(a && a.engine === 'nexusphp', '站点引擎不对');
  need(a.catMap.movie === '401', '电影分类没映射：' + JSON.stringify(a.catMap));
  need(a.catMap.doc === '402', 'Documentary 没自动映射成 doc');
  need(a.upload && a.upload.formPath === '/upload.php', '上传映射丢了');
});

check('缺密钥回退 NO_KEY', function () {
  const r = sitePack.load({ file: ENC, key: '' });
  need(!r.ok && r.reason === 'NO_KEY', '缺密钥应回退 NO_KEY：' + JSON.stringify(r));
});

check('错误密钥和篡改都解不开', function () {
  const wrong = sitePack.load({ file: ENC, key: crypto.randomBytes(32).toString('hex') });
  need(!wrong.ok && wrong.reason === 'BAD_PACK', '错误密钥应失败');
  const raw = fs.readFileSync(ENC, 'utf8');
  const badFile = path.join(TMP, 'tampered.enc');
  fs.writeFileSync(badFile, raw.slice(0, 20) + (raw[20] === 'A' ? 'B' : 'A') + raw.slice(21));
  const bad = sitePack.load({ file: badFile, key: KEY });
  need(!bad.ok && bad.reason === 'BAD_PACK', '篡改应失败');
});

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
const pass = results.filter(function (r) { return r[0] }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);
