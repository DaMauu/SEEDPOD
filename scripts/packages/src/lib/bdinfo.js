var normS = function (s) { return s.replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ').trim(); };
var noComma = function (s) { var p; do { p = s; s = s.replace(/(\d),(\d{3})(?!\d)/g, '$1$2'); } while (s !== p); return s; };
var normBytes = function (v) {
    var m = (v || '').match(/[\d,]+/);
    return m ? Number(m[0].replace(/,/g, '')).toLocaleString('en-US') + ' bytes' : v;
};
var normLen = function (v) {
    var m = (v || '').match(/^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/);
    return m ? parseInt(m[1], 10) + ':' + m[2] + ':' + m[3] : v;
};
var normFps = function (l, roundFlag) {
    return roundFlag ? l.replace(/(\d+(?:\.\d+)?)\s*fps/i, function (_, n) { return Math.round(parseFloat(n)) + ' fps'; }) : l;
};

export function parseBd(raw, roundFlag) {
    var useRound = roundFlag === true;
    var d = { title: '', label: '', discSize: '', protection: '', playlist: '', size: '', length: '', bitrate: '', videos: [], audios: [], subs: [] };
    String(raw || '').split(/\r?\n/).map(function (l) { return l.replace(/\u00a0/g, ' ').trim(); }).filter(Boolean).forEach(function (line) {
        var m;
        if ((m = line.match(/^Disc Title:\s*(.+)$/i))) d.title = m[1].trim();
        else if ((m = line.match(/^Disc Label:\s*(.+)$/i))) d.label = m[1].trim();
        else if ((m = line.match(/^Disc Size:\s*(.+)$/i))) d.discSize = normBytes(m[1]);
        else if ((m = line.match(/^Protection:\s*(.+)$/i))) d.protection = m[1].trim();
        else if ((m = line.match(/^Playlist:\s*(.+)$/i))) d.playlist = m[1].trim();
        else if ((m = line.match(/^Size:\s*(.+)$/i))) d.size = normBytes(m[1]);
        else if ((m = line.match(/^Length:\s*(.+)$/i))) d.length = normLen(m[1].trim());
        else if ((m = line.match(/^Total Bitrate:\s*(.+)$/i))) d.bitrate = m[1].trim().replace(/\s+/g, ' ');
        else if ((m = line.match(/^Video:\s*(.+)$/i))) d.videos.push(normFps(noComma(normS(m[1])), useRound));
        else if ((m = line.match(/^Audio:\s*(.+)$/i))) d.audios.push(noComma(normS(m[1])));
        else if ((m = line.match(/^Subtitles?:\s*(.+)$/i))) d.subs.push(noComma(normS(m[1])));
    });
    if (!d.label && d.title) d.label = d.title;
    return d;
}

export function nameFromLabel(l) {
    if (!l) return '';
    var s = l.replace(/[._]/g, ' ');
    var i = s.search(/\b(19|20)\d{2}\b/);
    return (i >= 0 ? s.slice(0, i) : s).replace(/\s+/g, ' ').trim();
}

export function isDisc4K(d) {
    return /4320p|8K|2160p|UHD|BD66|BD100/i.test((d.videos || []).join(' ')) || /UHD|4320|8K|2160|BD66|BD100/i.test((d.label || '') + ' ' + (d.title || ''));
}

export function buildBd(d) {
    var o = [];
    if (d.title) o.push('Disc Title: ' + d.title);
    if (d.label) o.push('Disc Label: ' + d.label);
    if (d.discSize) o.push('Disc Size: ' + d.discSize);
    if (d.protection) o.push('Protection: ' + d.protection);
    if (d.playlist) o.push('Playlist: ' + d.playlist);
    if (d.size) o.push('Size: ' + d.size);
    if (d.length) o.push('Length: ' + d.length);
    if (d.bitrate) o.push('Total Bitrate: ' + d.bitrate);
    (d.videos || []).forEach(function (v) { o.push('Video: ' + v); });
    (d.audios || []).forEach(function (v) { o.push('Audio: ' + v); });
    (d.subs || []).forEach(function (v) { o.push('Subtitle: ' + v); });
    return o.join('\n');
}
