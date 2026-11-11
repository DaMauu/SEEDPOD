/* 把 cookies.tmp.json 里的 cookie 加密写进服务端凭据（在服务器上跑，用自己的密钥）。
   用法：PTA_DATA=/opt/seedpod/data node scripts/load-cookies.js /path/to/cookies.json */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const box = require(path.join(ROOT, 'server', 'secretbox.js'));
const DATA_DIR = path.resolve(process.env.PTA_DATA || './data');
const CRED = path.join(DATA_DIR, 'credentials.json');

const src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.log('用法：node scripts/load-cookies.js <cookies.json>'); process.exit(1); }
const incoming = JSON.parse(fs.readFileSync(src, 'utf8'));
const key = box.loadKey(DATA_DIR);
let all = {};
try { all = JSON.parse(fs.readFileSync(CRED, 'utf8')) || {}; } catch (e) { all = {}; }

let n = 0;
for (const host of Object.keys(incoming)) {
  const cookie = String(incoming[host] || '');
  if (!cookie) continue;
  const cur = all[host] || {};
  cur.cookie = box.encrypt(cookie, key.key);
  cur.updatedAt = new Date().toISOString();
  all[host] = cur;
  n++;
}
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(CRED, JSON.stringify(all, null, 1), { mode: 0o600 });
console.log('imported ' + n + ' hosts, key source=' + key.source + ', total=' + Object.keys(all).length);
