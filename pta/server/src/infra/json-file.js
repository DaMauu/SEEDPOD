/* JSON 文件原子写：先写临时文件再 rename，避免半截文件；权限固定 0600。 */
const fs = require('fs');
const path = require('path');

function writeAtomic(file, data, mode) {
  const target = path.resolve(file);
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  const tmp = target + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', { mode: mode || 0o600 });
  fs.renameSync(tmp, target);
  try { fs.chmodSync(target, mode || 0o600); } catch (e) { /* 尽力而为 */ }
}
function writeAtomicText(file, text, mode) {
  const target = path.resolve(file);
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  const tmp = target + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, String(text), { mode: mode || 0o600 });
  fs.renameSync(tmp, target);
  try { fs.chmodSync(target, mode || 0o600); } catch (e) { /* 尽力而为 */ }
}
module.exports = { writeAtomic, writeAtomicText };
