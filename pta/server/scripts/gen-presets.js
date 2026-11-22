#!/usr/bin/env node
/* 把全局预设同步给前端（Vite 直接 import JSON）；--check 只校验不写。 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'server', 'pack', 'presets.preset.json');
const OUT = path.join(ROOT, 'web', 'shared', 'presets.json');
const CHECK = process.argv.includes('--check');

function read(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
}
function stable(doc) {
  return JSON.stringify(doc, null, 2) + '\n';
}

const src = read(SRC);
if (!src || !src.types || !src.search) {
  console.error('全局预设缺少 types/search：' + SRC);
  process.exit(1);
}
const text = stable(src);
if (CHECK) {
  const cur = (function () { try { return fs.readFileSync(OUT, 'utf8'); } catch (e) { return ''; } })();
  if (cur !== text) {
    console.error('前端预设不是最新：跑 node pta/scripts/gen-presets.js');
    process.exit(1);
  }
  console.log('前端预设一致：' + Object.keys(src.types).length + ' 个类型');
  process.exit(0);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, text);
console.log('已写入 ' + OUT);
