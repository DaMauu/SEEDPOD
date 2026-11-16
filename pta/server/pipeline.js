/* 流水线扩展点：新功能放 pta/server/steps/*.js，启动时自动加载并注册。
   阶段：crawl / screen / review / publish / crossseed
   用法：
     const pipeline = require('../pipeline');
     pipeline.on('publish', '功能名', async (ctx, state) => { ... });
   调度器每轮按阶段顺序执行已注册钩子；钩子报错只记录，不拖垮整轮。 */
const fs = require('fs');
const path = require('path');

const PHASES = ['crawl', 'screen', 'review', 'publish', 'crossseed'];
const hooks = Object.create(null);
const loaded = new Set();

function on(phase, name, fn) {
  const p = String(phase || '').toLowerCase();
  if (PHASES.indexOf(p) < 0) throw new Error('未知流水线阶段：' + phase);
  if (typeof fn !== 'function') throw new Error('钩子必须是函数');
  if (!hooks[p]) hooks[p] = [];
  if (hooks[p].some(h => h.name === name)) return;
  hooks[p].push({ name: String(name || ''), fn });
}

async function run(phase, ctx, state) {
  const list = hooks[phase] || [];
  const out = [];
  for (const h of list) {
    try {
      const r = await h.fn(ctx, state || {});
      out.push({ name: h.name, ok: true, result: r === undefined ? null : r });
    } catch (e) {
      out.push({ name: h.name, ok: false, error: String(e && e.message || e).slice(0, 200) });
    }
  }
  return out;
}

function loadSteps() {
  const dir = path.join(__dirname, 'steps');
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => /\.js$/.test(f)); } catch (e) { return []; }
  files.forEach(function (f) {
    const full = path.join(dir, f);
    if (loaded.has(full)) return;
    try { require(full); loaded.add(full); } catch (e) { console.warn('[seedpod] step 加载失败：' + f + ' · ' + (e && e.message || e)); }
  });
  return files;
}

function list() {
  const out = {};
  PHASES.forEach(p => { out[p] = (hooks[p] || []).map(h => h.name); });
  return out;
}

module.exports = { on, run, loadSteps, list, PHASES };
