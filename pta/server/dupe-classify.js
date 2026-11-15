/* 目标站搜索结果判重：纯函数，输入源标题/体积和搜索结果行。
   体积容差优先用流程规则（百分比）；没给就保持旧的 2.5GB / 5%。 */
const DISC_RE = /(?:UHD|Blu-?Ray|BluRay|BDMV|Full\s*Disc|原盘|ISO\b)/i;
const SKIP_RE = /(?:Remux|Encode|WEB-?DL|WEBRip|HDTV|DVDRip|x264|x265|H\.?264|H\.?265|AVC|HEVC)/i;
const DIY_RE = /\bDIY\b/i;
const UHD_RE = /(?:2160p|\b4K\b|\bUHD\b)/i;

function classify(srcTitle, srcGB, rows, tolerancePct) {
  const src4k = UHD_RE.test(srcTitle);
  const pct = Number(tolerancePct);
  const usePct = Number.isFinite(pct) && pct > 0;
  let diy = null;
  for (const r of rows || []) {
    const t = String(r.title || '');
    if (!t || !DISC_RE.test(t) || SKIP_RE.test(t)) continue;
    if (UHD_RE.test(t) !== src4k) continue;
    const gb = Number(r.sizeBytes) ? Number(r.sizeBytes) / 1073741824 : 0;
    const sizeOk = !(srcGB > 0 && gb > 0) || (usePct
      ? Math.abs(gb - srcGB) / Math.max(srcGB, gb) <= pct / 100
      : (Math.abs(gb - srcGB) <= 2.5 || Math.abs(gb - srcGB) / srcGB <= 0.05));
    if (!sizeOk) continue;
    if (DIY_RE.test(t)) { if (!diy) diy = r; continue; }
    return { status: 'dupe', row: r };
  }
  if (diy) return { status: 'diy', row: diy };
  return { status: 'clean', row: null };
}

module.exports = { classify: classify, DISC_RE: DISC_RE, DIY_RE: DIY_RE, UHD_RE: UHD_RE };
