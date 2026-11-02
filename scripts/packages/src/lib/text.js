import { RE } from './patterns.js';

export function normalizeImdbId(raw) {
    var s = String(raw || '').trim();
    if (!s || s === '0') return '';
    var m = s.match(/tt\d{7,9}/i);
    if (m) return m[0].toLowerCase();
    var digits = s.replace(/\D/g, '');
    return digits ? ('tt' + digits.padStart(7, '0')) : '';
}

export function is4kText(text) { return RE.UHD.test(text || ''); }

export function stripReleaseTags(str) {
    return (str || '').replace(/🌐网页原盘|⚡API原盘|Untouched 原盘|🔍查B站|🚀转种|📥推qB|已查|已推/g, '').replace(RE.TAG_PREFIX, '').replace(/(?:\s+\d+\.\d+)+\s*$/g, '').trim();
}

export function parseSizeToGB(sizeStr) {
    if (typeof sizeStr === 'number') return sizeStr / (1024 * 1024 * 1024);
    if (!sizeStr) return 0;
    var m = String(sizeStr).replace(/,/g, '').match(RE.SIZE);
    if (!m) return 0;
    var val = parseFloat(m[1]), unit = m[2].toUpperCase();
    return unit.indexOf('T') === 0 ? val * 1024 : (unit.indexOf('M') === 0 ? val / 1024 : (unit.indexOf('K') === 0 ? val / (1024 * 1024) : val));
}

export function extractMovieYear(t) {
    var re = /(?:^|[\s.\[\]()\-_])((?:19|20)\d{2})(?=[\s.\[\]()\-_]|$)/g, found = [], m;
    while ((m = re.exec(t)) !== null) found.push({ year: m[1], idx: m.index, len: m[0].length });
    return found;
}

export function parseTitleMeta(rawTitle, extraSpec) {
    var t = (rawTitle || '').trim();
    var found = extractMovieYear(t);
    var year = '', cleanTitle = '';
    for (var i = found.length - 1; i >= 0; i--) {
        var head = t.substring(0, found[i].idx).replace(/\s+AKA\s+.*/i, '').replace(/^[^\x00-\x7F]+/, '').replace(/[._]/g, ' ').trim();
        if (head) { cleanTitle = head; year = found[i].year; break; }
    }
    if (!cleanTitle) cleanTitle = t.replace(/^[^\x00-\x7F]+/, '').replace(/[._]/g, ' ').trim();
    var group = (t.replace(/@[A-Za-z0-9]+$/i, '').match(/-([A-Za-z0-9]+)$/) || ['', ''])[1];
    return { movieTitle: cleanTitle || t, movieYear: year, releaseGroup: group, is4K: is4kText(t + ' ' + (extraSpec || '')) };
}

export function parseCleanSubtitleString(rawSubStr) {
    if (!rawSubStr) return { cnTitle: '', regionBracket: '' };
    var s = stripReleaseTags(rawSubStr);
    var regMatch = s.match(/【([^】]*原盘[^】]*)】/) || s.match(/\[([^\]]*原盘[^\]]*)\]/);
    var tailVerMatch = !regMatch && s.match(/(美版|英版|法版|德版|日版|韩版|港版|台版|欧版|澳版|加版|西班牙版|意大利版|澳大利亚)原盘/);
    var regionBracket = regMatch ? regMatch[1].trim() : (tailVerMatch ? tailVerMatch[0].trim() : '');
    var firstSeg = stripReleaseTags(s.split(/\||\/|【|\[|类别:|類別:|导演:|主演:/)[0]);
    return { cnTitle: /[\u4e00-\u9fa5]/.test(firstSeg) ? firstSeg : '', regionBracket: regionBracket };
}

export function parseRelativeAgeDays(txt) {
    var text = String(txt || '').trim();
    if (!text || text.length > 14) return null;
    if (!/^(\d+\s*(年|月|周|天|日|时|小时|分|分钟)\s*)+$/.test(text)) return null;
    var unitWeights = [['年', 365], ['月', 30], ['周', 7], ['[天日]', 1], ['(?:小时|时)', 1 / 24], ['(?:分钟|分)', 1 / 1440]];
    var totalDays = 0;
    unitWeights.forEach(function (uw) {
        var m = text.match(new RegExp('(\\d+)\\s*' + uw[0]));
        if (m) totalDays += parseInt(m[1], 10) * uw[1];
    });
    return { days: totalDays, text: text };
}
