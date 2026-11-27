#!/usr/bin/env node
/* 写入当前任务的实时进度，Telegram bot 的动态进度卡会读取它。
   文件放在用户配置目录，0600；带 updatedAt/ttl，过期自动回退到“工作中”。 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
let percent = null;
let goal = '';
let note = '';
let ttlSec = 900;
let file = process.env.TELEGRAM_PROGRESS_FILE || path.join(os.homedir(), '.config', 'opencode', 'live-progress.json');
let clear = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--percent' || a === '-p') percent = Number(args[++i]);
  else if (a === '--goal' || a === '-g') goal = String(args[++i] || '');
  else if (a === '--note' || a === '-n') note = String(args[++i] || '');
  else if (a === '--ttl') ttlSec = Math.max(30, Number(args[++i]) || 900);
  else if (a === '--file') file = String(args[++i] || '');
  else if (a === '--clear') clear = true;
  else if (a === '--help' || a === '-h') {
    console.log('用法：node scripts/set-progress.js --percent 35 [--goal 当前任务] [--note 说明] [--ttl 900]');
    process.exit(0);
  }
}
if (clear) {
  try { fs.unlinkSync(file); } catch (e) { /* 没有就忽略 */ }
  console.log('已清除进度文件：' + file);
  process.exit(0);
}
if (!Number.isFinite(percent)) {
  console.error('缺少 --percent，或不是数字');
  process.exit(2);
}
const pct = Math.max(0, Math.min(100, Math.round(percent)));
const dir = path.dirname(file);
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const data = { percent: pct, goal: goal, note: note, updatedAt: Date.now(), ttlSec: ttlSec };
fs.writeFileSync(file, JSON.stringify(data, null, 1) + '\n', { mode: 0o600 });
console.log(pct + '% -> ' + file);
