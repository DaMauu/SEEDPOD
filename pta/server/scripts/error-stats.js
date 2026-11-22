/* CLI：按 code/stage 统计失败队列，不启 HTTP。用法：node pta/scripts/error-stats.js [--limit 200] */
const path = require('path');
const { openDB } = require('../db');
const { makeErrorStats } = require('../error-stats');
const { read } = require('../env');

const dataDir = path.resolve(read('DATA_DIR', 'PTA_DATA') || path.join(__dirname, '..', '..', 'data'));
const db = openDB(path.join(dataDir, 'seedpod.db'));
const one = (s, ...a) => db.prepare(s).get(...a);
const all = (s, ...a) => db.prepare(s).all(...a);
const jparse = (x) => { try { return JSON.parse(x); } catch (e) { return null; } };
const stats = makeErrorStats({ db, one, all, jparse }).snapshot(process.argv.includes('--limit') ? process.argv[process.argv.indexOf('--limit') + 1] : 200);
console.log(JSON.stringify(stats, null, 2));
db.close();
