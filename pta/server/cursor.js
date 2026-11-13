/* 抓取游标：一页到底后翻到下一个分类，分类到底后回到第一个。
   纯函数，方便离线断言。 */
function nextCursor(opts) {
  const catCount = Math.max(0, Number(opts && opts.catCount) || 0);
  const catIdx = Math.max(0, Number(opts && opts.catIdx) || 0);
  const page = Math.max(0, Number(opts && opts.page) || 0);
  const rows = Math.max(0, Number(opts && opts.rows) || 0);
  const maxPages = Math.max(1, Number(opts && opts.maxPages) || 50);
  const rotate = !(opts && opts.rotate === false);
  if (rows > 0 && page < maxPages) return { catIdx: catIdx, page: page, rotated: false };
  if (rotate && catCount > 1) return { catIdx: (catIdx + 1) % catCount, page: 0, rotated: true };
  return { catIdx: catIdx, page: 0, rotated: false };
}

module.exports = { nextCursor };
