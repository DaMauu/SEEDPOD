/* 面板账号文件：scrypt 哈希、首次环境变量引导、改名/改密。纯临时目录。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const makeAuth = require('../src/features/auth/store');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-auth-'));
const auth = makeAuth(DATA);
const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(c, m) { if (!c) throw new Error(m); }

check('首次用环境变量初始化，只存 scrypt 哈希', function () {
  need(auth.status().reason === 'NO_ACCOUNT', '空目录不该有账号');
  const d = auth.ensureBootstrap('admin', 'old-pass-123');
  need(d && d.user === 'admin', '初始化失败');
  need(auth.verify('old-pass-123', d) === true, '正确密码验不过');
  need(auth.verify('wrong', d) === false, '错误密码通过了');
  const text = fs.readFileSync(auth.FILE, 'utf8');
  need(text.indexOf('old-pass-123') < 0, '文件里出现明文密码');
  need((fs.statSync(auth.FILE).mode & 0o777) === 0o600, 'auth.json 权限不是 0600');
});

check('改名/改密后旧密码失效，环境变量不再覆盖', function () {
  const r = auth.update({ user: 'new-admin', newPass: 'new-pass-456' });
  need(r.ok && r.user === 'new-admin', '更新失败：' + JSON.stringify(r));
  need(auth.verify('old-pass-123') === false, '旧密码还能用');
  need(auth.verify('new-pass-456') === true, '新密码不能用');
  const again = auth.ensureBootstrap('admin', 'old-pass-123');
  need(again && again.user === 'new-admin', '环境变量覆盖了面板账号');
  const text = fs.readFileSync(auth.FILE, 'utf8');
  need(text.indexOf('new-pass-456') < 0, '文件里出现新明文密码');
});

check('非法用户名/短密码被拒绝', function () {
  need(auth.update({ user: 'bad user', newPass: '' }).code === 'BAD_USER', '空格用户名没拦住');
  need(auth.update({ user: 'new-admin', newPass: '1234567' }).code === 'BAD_PASS', '短密码没拦住');
});

try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
const pass = results.filter(function (r) { return r[0]; }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);
