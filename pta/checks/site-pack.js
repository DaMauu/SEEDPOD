/* 站点包检查：加密/解密、篡改、缺密钥、私钥错误、密文无明文 host、生成器 dry-run。 */
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const secretbox = require('../server/secretbox');
const sitePack = require('../server/site-pack');
const admin = require('../server/site-pack-admin');

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
  need(/^v[12]:/.test(raw), '不是 v1/v2 密文');
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

check('站点包覆盖率与例外列表', function () {
  const o = admin.overview({ DATA_DIR: TMP }, { file: ENC, key: KEY });
  need(o.available === true, '站点包不可用：' + o.reason);
  need(o.status.sites === 2, '站点数不对：' + o.status.sites);
  need(o.coverage.total === 3 && o.coverage.mapped === 2 && o.coverage.other === 1, '覆盖率不对：' + JSON.stringify(o.coverage));
  need(o.totalExceptions === 1 && o.exceptions[0].label === 'Unknown Thing', '例外列表不对：' + JSON.stringify(o.exceptions));
  need(o.exceptions[0].host === 'b.example' && o.exceptions[0].id === '9', '例外站/ID 不对');
});

check('确认例外写私有 data/site-defs', function () {
  const r = admin.confirm({ DATA_DIR: TMP }, { host: 'b.example', id: '9', purpose: 'movie' }, { file: ENC, key: KEY });
  need(r.ok && r.data.saved === true, '确认失败：' + JSON.stringify(r));
  const file = path.join(DEF, 'b.example.json');
  need(fs.existsSync(file), '私有定义没写');
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  const hit = (d.catList || []).filter(function (x) { return x.id === '9'; })[0];
  need(hit && hit.purpose === 'movie', 'catList 没更新：' + JSON.stringify(d.catList));
  need(d.cats && d.cats.movie && d.cats.movie.indexOf('9') >= 0, 'cats 没更新：' + JSON.stringify(d.cats));
  need(d.catMap && d.catMap.movie === '9', 'catMap 没更新：' + JSON.stringify(d.catMap));
  need((fs.statSync(file).mode & 0o777) === 0o600, '私有定义不是 0600');
});

check('确认后覆盖率和例外数回读', function () {
  const o = admin.overview({ DATA_DIR: TMP }, { file: ENC, key: KEY });
  need(o.coverage.mapped === 3 && o.coverage.other === 0, '确认后覆盖率不对：' + JSON.stringify(o.coverage));
  need(o.totalExceptions === 0, '确认后还有例外：' + o.totalExceptions);
});

check('非法站点/用途被拒', function () {
  const badHost = admin.confirm({ DATA_DIR: TMP }, { host: '../x', id: '9', purpose: 'movie' }, { file: ENC, key: KEY });
  need(!badHost.ok && badHost.code === 'BAD_HOST', '坏 host 没被拒');
  const badPurpose = admin.confirm({ DATA_DIR: TMP }, { host: 'b.example', id: '9', purpose: 'nope' }, { file: ENC, key: KEY });
  need(!badPurpose.ok && badPurpose.code === 'BAD_PURPOSE', '坏用途没被拒');
});

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* 忽略：失败不影响主流程 */ }
const pass = results.filter(function (r) { return r[0] }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);
