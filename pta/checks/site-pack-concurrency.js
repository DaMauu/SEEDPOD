/* 站点包例外并发写入：两个进程同时确认不同分类，锁住读改写，不能丢更新。 */
const { spawn, spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const admin = require('../server/site-pack-admin');

const ROOT = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-packcc-'));
const DEF = path.join(TMP, 'site-defs');
const ENC = path.join(TMP, 'pack', 'site-pack.enc');
const KEY = crypto.randomBytes(32).toString('hex');
fs.mkdirSync(DEF, { recursive: true });
fs.writeFileSync(path.join(DEF, 'a.example.json'), JSON.stringify({
  host: 'a.example', base: 'https://a.example', engine: 'nexusphp',
  catMap: [{ id: '401', label: '电影', purpose: 'movie' }, { id: '402', label: '纪录片', purpose: 'other' }]
}, null, 2));
const build = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-site-pack.js'), '--data', TMP, '--out', ENC], {
  env: Object.assign({}, process.env, { PTA_SITE_PACK_KEY: KEY }), encoding: 'utf8'
});

const code = `
const admin = require(process.env.ADMIN);
const r = admin.confirm({ DATA_DIR: process.env.DATA }, { host: 'a.example', id: process.env.ID, purpose: process.env.PURPOSE }, { file: process.env.PACK, key: process.env.KEY });
process.stdout.write(JSON.stringify(r));
process.exit(r.ok ? 0 : 1);
`;
function worker(id, purpose) {
  return new Promise(function (resolve) {
    const c = spawn(process.execPath, ['-e', code], {
      env: Object.assign({}, process.env, {
        ADMIN: path.join(ROOT, 'server', 'site-pack-admin.js'),
        DATA: TMP, PACK: ENC, KEY: KEY, ID: id, PURPOSE: purpose,
        PTA_SITE_PACK_TEST_DELAY_MS: '300'
      }),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '', err = '';
    c.stdout.on('data', d => { out += d; });
    c.stderr.on('data', d => { err += d; });
    c.on('close', code2 => resolve({ code: code2, out: out, err: err }));
  });
}
(async function () {
  const both = await Promise.all([worker('401', 'movie'), worker('402', 'tv')]);
  let list = [];
  let lockLeft = false;
  try {
    const d = JSON.parse(fs.readFileSync(path.join(DEF, 'a.example.json'), 'utf8'));
    list = d.catList || [];
    lockLeft = fs.existsSync(path.join(DEF, '.site-pack.lock'));
  } catch (e) { /* 下面报错 */ }
  const purposeOf = function (id) { const hit = list.filter(function (x) { return x.id === id; })[0]; return hit ? hit.purpose : ''; };
  const lockDir = path.join(DEF, '.site-pack.lock');
  let staleOk = false, timeoutOk = false, releaseOk = false;
  try {
    fs.mkdirSync(lockDir);
    const old = new Date(Date.now() - 20000);
    fs.utimesSync(lockDir, old, old);
    const r = admin.confirm({ DATA_DIR: TMP }, { host: 'a.example', id: '401', purpose: 'movie' }, { file: ENC, key: KEY });
    staleOk = r.ok && !fs.existsSync(lockDir);
  } catch (e) { staleOk = false; }
  try {
    fs.mkdirSync(lockDir);
    process.env.PTA_SITE_PACK_LOCK_WAIT_MS = '120';
    const t = Date.now();
    const r = admin.confirm({ DATA_DIR: TMP }, { host: 'a.example', id: '402', purpose: 'tv' }, { file: ENC, key: KEY });
    delete process.env.PTA_SITE_PACK_LOCK_WAIT_MS;
    timeoutOk = !r.ok && r.code === 'SITE_PACK_BUSY' && Date.now() - t >= 100;
    fs.rmdirSync(lockDir);
  } catch (e) { timeoutOk = false; try { fs.rmdirSync(lockDir); } catch (e2) { /* 已清理 */ } }
  try {
    const r = admin.confirm({ DATA_DIR: TMP }, { host: 'a.example', id: '999999', purpose: 'tv' }, { file: ENC, key: KEY });
    releaseOk = !r.ok && r.code === 'NO_CATEGORY' && !fs.existsSync(lockDir);
  } catch (e) { releaseOk = false; }
  const pass = build.status === 0 && both.every(function (x) { return x.code === 0; }) &&
    purposeOf('401') === 'movie' && purposeOf('402') === 'tv' && !lockLeft && staleOk && timeoutOk && releaseOk;
  console.log((pass ? 'PASS' : 'FAIL') + '  两个进程并发确认不丢更新' + (pass ? '' : '：' + JSON.stringify({
    build: build.status, workers: both.map(function (x) { return { code: x.code, out: x.out.slice(0, 120), err: x.err.slice(0, 120) }; }),
    purposes: { '401': purposeOf('401'), '402': purposeOf('402') }, lockLeft: lockLeft, staleOk: staleOk, timeoutOk: timeoutOk, releaseOk: releaseOk
  })));
  console.log('\n' + (pass ? '1/1' : '0/1') + ' 通过');
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(pass ? 0 : 1);
})();
