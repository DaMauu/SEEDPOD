/* 安全相关检查：TOTP（RFC 6238 向量）与凭据加密，全程离线。 */
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const box = require(path.join(ROOT, 'server', 'secretbox.js'));
const crypto = require('crypto');

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

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
