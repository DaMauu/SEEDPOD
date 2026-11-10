/* 安全相关检查：TOTP（RFC 6238 向量）与凭据加密，全程离线。 */
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const totp = require(path.join(ROOT, 'server', 'totp.js'));
const box = require(path.join(ROOT, 'server', 'secretbox.js'));
const crypto = require('crypto');

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

/* RFC 4648 测试向量 */
check('base32 解码', () => {
  need(totp.base32Decode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ').toString() === '12345678901234567890', 'base32 解出来不对');
  need(totp.base32Decode('MZXW6===').toString() === 'foo', '短串解出来不对');
  need(totp.base32Decode('mzxw6ytboi======').toString() === 'foobar', '小写与填充没处理');
});

/* RFC 6238 附录 B 的种子是 ASCII "12345678901234567890" */
const SEED = Buffer.from('12345678901234567890', 'utf8');
check('HOTP / RFC 4226 向量', () => {
  need(totp.hotp(SEED, 0, 6, 'sha1') === '755224', 'counter 0 不对：' + totp.hotp(SEED, 0, 6, 'sha1'));
  need(totp.hotp(SEED, 1, 6, 'sha1') === '287082', 'counter 1 不对');
  need(totp.hotp(SEED, 2, 6, 'sha1') === '359152', 'counter 2 不对');
});

check('TOTP / RFC 6238 向量', () => {
  const cases = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037']
  ];
  for (const [sec, want] of cases) {
    const got = totp.totp(SEED, { t: sec * 1000, digits: 8 });
    need(got === want, sec + 's 应为 ' + want + '，实际 ' + got);
  }
});

check('TOTP 校验带容错', () => {
  const now = 1700000000000;
  const code = totp.totp(SEED, { t: now });
  need(totp.verify(code, SEED, { t: now }), '同一时刻应通过');
  need(totp.verify(totp.totp(SEED, { t: now + 30000 }), SEED, { t: now }), '下一个窗口应通过');
  need(!totp.verify(totp.totp(SEED, { t: now + 300000 }), SEED, { t: now }), '差太远不该通过');
  need(!totp.verify('abc', SEED, { t: now }), '非数字不该通过');
});

check('凭据加密往返', () => {
  const key = crypto.randomBytes(32);
  const plain = 'p@ssw0rd-测试-2FA';
  const enc = box.encrypt(plain, key);
  need(enc.indexOf('v1:') === 0, '密文格式不对');
  need(enc.indexOf(plain) < 0, '密文里出现了明文');
  need(box.decrypt(enc, key) === plain, '解密回不来');
  const key2 = crypto.randomBytes(32);
  let failed = false;
  try { box.decrypt(enc, key2); } catch (e) { failed = true; }
  need(failed, '换错密钥居然解开了');
  const e1 = box.encrypt(plain, key), e2 = box.encrypt(plain, key);
  need(e1 !== e2, '同样明文两次加密结果相同（IV 没随机）');
});

check('密钥解析', () => {
  const hex = crypto.randomBytes(32).toString('hex');
  need(box.parseKey(hex).length === 32, 'hex 密钥没解对');
  need(box.parseKey(crypto.randomBytes(32).toString('base64')).length === 32, 'base64 密钥没解对');
  need(box.parseKey('short') === null, '短密钥应判为无效');
  need(box.parseKey('') === null, '空密钥应判为无效');
});

for (const [ok, name, why] of results) console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '  → ' + why));
const failed = results.filter(r => !r[0]).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
process.exit(failed ? 1 : 0);
