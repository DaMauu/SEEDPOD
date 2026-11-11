/* 体积单位换算：站点上「9.07 GB」「22.10 GiB」「812 KB」这类写法统一成字节数。
   参考 Vertex 的 calSize/formatSize（MIT），这里只保留我们需要的部分：解析成字节、再格式化回可读字符串。 */
const UNITS = {
  '': 1,
  B: 1,
  K: 1024, KB: 1024, KIB: 1024,
  M: 1024 * 1024, MB: 1024 * 1024, MIB: 1024 * 1024,
  G: 1024 * 1024 * 1024, GB: 1024 * 1024 * 1024, GIB: 1024 * 1024 * 1024,
  T: 1024 * 1024 * 1024 * 1024, TB: 1024 * 1024 * 1024 * 1024, TIB: 1024 * 1024 * 1024 * 1024,
  P: 1024 * 1024 * 1024 * 1024 * 1024, PB: 1024 * 1024 * 1024 * 1024 * 1024
};

/* '9.07 GB' / '22.10GiB' / '812 KB' → 9743... 字节；认不出返回 0 */
function parseSize(s) {
  const m = /([\d.,]+)\s*([a-z]*)/i.exec(String(s || ''));
  if (!m) return 0;
  const num = Number(String(m[1]).replace(/,/g, ''));
  if (!Number.isFinite(num)) return 0;
  const unit = String(m[2] || '').toUpperCase();
  const mul = UNITS[unit] || (unit.length > 1 ? UNITS[unit.charAt(0)] || 1 : 1);
  return Math.round(num * mul);
}

/* 字节 → '1.23 GB'（1024 进制，跟 NexusPHP 站上的写法一致） */
function formatSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let i = 0, x = n;
  while (x >= 1024 && i < units.length - 1) { x /= 1024; i++; }
  return (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)) + ' ' + units[i];
}

module.exports = { parseSize: parseSize, formatSize: formatSize };
