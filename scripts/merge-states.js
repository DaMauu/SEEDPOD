/* 并行采样会把状态写进多个 _state.*.json（避免同时写一个文件打架），这里合并回 _state.json。
   只读本地文件。用法：node scripts/merge-states.js [--keep]   默认合并后删掉分片文件 */
const fs = require('fs');
const path = require('path');
const DIR = path.resolve(__dirname, '..', 'pta', 'data', 'samples');
const MAIN = path.join(DIR, '_state.json');

function readJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; } }

const main = readJson(MAIN, {});
const shards = fs.readdirSync(DIR).filter(function (f) { return /^_state\..+\.json$/.test(f); });
let added = 0, updated = 0;

shards.forEach(function (f) {
  const part = readJson(path.join(DIR, f), {});
  Object.keys(part).forEach(function (host) {
    const mine = main[host];
    const theirs = part[host];
    if (!mine) { main[host] = theirs; added++; return; }
    /* 取时间更晚的一条 */
    const a = Date.parse(mine.at || 0), b = Date.parse(theirs.at || 0);
    if (b >= a) { main[host] = theirs; updated++; }
  });
});

fs.writeFileSync(MAIN, JSON.stringify(main, null, 1), 'utf8');
if (process.argv.indexOf('--keep') < 0) {
  shards.forEach(function (f) { try { fs.unlinkSync(path.join(DIR, f)); } catch (e) {} });
}
const notes = {};
Object.keys(main).forEach(function (h) { const n = main[h].note || 'ok'; notes[n] = (notes[n] || 0) + 1; });
console.log('合并 ' + shards.length + ' 个分片：新增 ' + added + '，更新 ' + updated + '，总计 ' + Object.keys(main).length + ' 站');
console.log('状态：' + Object.keys(notes).map(function (k) { return k + ' ' + notes[k]; }).join(' / '));
