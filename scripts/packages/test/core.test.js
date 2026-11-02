import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeImdbId, parseSizeToGB, parseTitleMeta, stripReleaseTags, parseCleanSubtitleString, parseRelativeAgeDays } from '../src/lib/text.js';
import { siteUrl, gzHeaders, extractHostKey, hostInSiteDatabase, shouldSiteUseApi, DEFAULT_SITE_DATABASE } from '../src/lib/sites.js';
import { parseBd, buildBd, isDisc4K, nameFromLabel } from '../src/lib/bdinfo.js';
import { composeSubtitle, buildAll, getRegionFromTitle, zhOnly, castList } from '../src/lib/subtitle.js';
import { inferSourceRegion, inferTorrentLabels } from '../src/lib/publish.js';
import { npDiscMatches, looseDiscMatches } from '../src/lib/dupe.js';

const BD = [
    'Disc Title: THE_DARK_HALF_1993',
    'Disc Label: THE_DARK_HALF_1993',
    'Disc Size: 48,234,567,890 bytes',
    'Protection: AACS',
    'Playlist: 00800.MPLS',
    'Size: 45,000,000,000 bytes',
    'Length: 01:02:03.000',
    'Total Bitrate: 30.5 Mbps',
    'Video: MPEG-4 AVC Video / 1920x1080 / 23.976 fps',
    'Audio: English / DTS-HD Master Audio / 5.1',
    'Audio: Chinese / DTS-HD Master Audio / 5.1',
    'Subtitle: English',
    'Subtitle: Chinese'
].join('\n');

test('normalizeImdbId accepts urls, bare ids, and digit padding', function () {
    assert.equal(normalizeImdbId('https://www.imdb.com/title/tt0109558/'), 'tt0109558');
    assert.equal(normalizeImdbId('TT109558'), 'tt0109558');
    assert.equal(normalizeImdbId('109558'), 'tt0109558');
    assert.equal(normalizeImdbId('0'), '');
    assert.equal(normalizeImdbId(''), '');
});

test('parseSizeToGB understands decimal units and raw byte counts', function () {
    assert.equal(parseSizeToGB('45.5 GiB'), 45.5);
    assert.equal(parseSizeToGB('1.5 TB'), 1536);
    assert.equal(parseSizeToGB('512 MB'), 0.5);
    assert.equal(parseSizeToGB(1024 * 1024 * 1024), 1);
    assert.equal(parseSizeToGB(''), 0);
});

test('parseTitleMeta pulls the movie year, group, and 4K flag', function () {
    var meta = parseTitleMeta('The.Dark.Half.1993.1080p.BluRay.AVC-GROUP', '');
    assert.equal(meta.movieTitle, 'The Dark Half');
    assert.equal(meta.movieYear, '1993');
    assert.equal(meta.releaseGroup, 'GROUP');
    assert.equal(meta.is4K, false);
    assert.equal(parseTitleMeta('Movie.2160p.UHD.BluRay', '').is4K, true);
});

test('stripReleaseTags and subtitle parsing keep the chinese title', function () {
    assert.equal(stripReleaseTags('官方 原盘 黑暗之半'), '黑暗之半');
    var parsed = parseCleanSubtitleString('黑暗之半 | 【美版原盘】 | 导演:某人');
    assert.equal(parsed.cnTitle, '黑暗之半');
    assert.equal(parsed.regionBracket, '美版原盘');
});

test('parseRelativeAgeDays adds mixed chinese units', function () {
    var age = parseRelativeAgeDays('2天3小时');
    assert.ok(Math.abs(age.days - (2 + 3 / 24)) < 1e-9);
    assert.equal(parseRelativeAgeDays('not a date'), null);
});

test('siteUrl builds search and download links per tracker family', function () {
    var np = siteUrl({ url: 'https://pterclub.net', type: 'np' }, 'search', { imdbId: 'tt0109558' });
    assert.match(np, /search_area=4/);
    assert.match(np, /tt0109558/);
    var u3d = siteUrl({ url: 'https://blutopia.cc/', type: 'unit3d' }, 'download', { id: 42 });
    assert.equal(u3d, 'https://blutopia.cc/torrents/download/42');
    var gz = siteUrl({ url: 'https://passthepopcorn.me', type: 'gz' }, 'details', { id: 7 });
    assert.equal(gz, 'https://passthepopcorn.me/torrents.php?id=7');
    assert.deepEqual(gzHeaders('user:secret:part'), { ApiUser: 'user', ApiKey: 'secret:part', Accept: 'application/json' });
    assert.equal(extractHostKey('https://www.PterClub.net/torrents.php'), 'pterclub.net');
    assert.equal(shouldSiteUseApi({ type: 'unit3d', apiKey: 'k' }), true);
    assert.equal(shouldSiteUseApi({ type: 'np', apiKey: 'k' }), false);
    assert.equal(hostInSiteDatabase('https://pterclub.net/torrents.php', DEFAULT_SITE_DATABASE), true);
    assert.equal(hostInSiteDatabase('https://evil.example/torrents.php', DEFAULT_SITE_DATABASE), false);
    var withCustom = Object.assign({}, DEFAULT_SITE_DATABASE, { Mine: { url: 'https://mine.example/', type: 'np' } });
    assert.equal(hostInSiteDatabase('mine.example', withCustom), true);
});

test('parseBd normalizes commas, length, and optional fps rounding', function () {
    var rounded = parseBd(BD, true);
    assert.equal(rounded.title, 'THE_DARK_HALF_1993');
    assert.equal(rounded.length, '1:02:03.000');
    assert.match(rounded.discSize, /48,234,567,890 bytes/);
    assert.match(rounded.videos[0], /24 fps/);
    assert.equal(parseBd(BD, false).videos[0].includes('23.976'), true);
    assert.equal(isDisc4K(rounded), false);
    assert.equal(isDisc4K(parseBd('Disc Label: MOVIE_2160p_UHD\nVideo: HEVC / 2160p')), true);
    assert.equal(nameFromLabel('THE_DARK_HALF_1993'), 'THE DARK HALF');
    var rebuilt = buildBd(rounded);
    assert.match(rebuilt, /Disc Title: THE_DARK_HALF_1993/);
    assert.match(rebuilt, /Subtitle: Chinese/);
});

test('composeSubtitle builds the pter-style subtitle line', function () {
    var disc = parseBd(BD, false);
    var bb = '◎译名 黑暗之半\n◎导演 乔治·罗梅罗 George A. Romero\n◎主演 蒂莫西·赫顿 Timothy Hutton / 艾米·马迪根';
    var line = composeSubtitle(disc, bb, { withSubtitle: true, subCast: 2, subDisc: '原盘' }, {
        titleSources: ['The Dark Half 1993 USA BluRay'],
        movieTitle: 'The Dark Half'
    });
    assert.match(line, /^黑暗之半 \| 美版原盘 \| 导演:乔治·罗梅罗 \| 主演:蒂莫西·赫顿 \/ 艾米·马迪根 \| \[中英语\] \| \[中英字\]$/);
    assert.equal(composeSubtitle(disc, '', { withSubtitle: false }, {}), '');
    assert.equal(getRegionFromTitle('港版原盘'), '港');
    assert.equal(zhOnly('蒂莫西·赫顿 Timothy Hutton'), '蒂莫西·赫顿');
    assert.deepEqual(castList('甲 / 甲 / 乙', 2), ['甲', '乙']);
});

test('buildAll wraps mediainfo when the hide flag is on', function () {
    var text = buildAll(parseBd(BD, false), ['https://imgbox.com/a.jpg'], '◎片名 黑暗之半', { useHide: true, useTag: true });
    assert.match(text, /^◎片名 黑暗之半\n\[img\]https:\/\/pterclub\.net\/pic\/CS\.png/);
    assert.match(text, /\[hide=bdinfo\]/);
    assert.match(text, /\[img\]https:\/\/imgbox\.com\/a\.jpg\[\/img\]/);
});

test('region and label inference follow the upload form vocabulary', function () {
    assert.equal(inferSourceRegion('◎产地 日本', 'Movie', ''), '日本');
    assert.equal(inferSourceRegion('', 'France 1993', ''), '欧美');
    assert.equal(inferSourceRegion('香港', '', ''), '香港');
    var labels = inferTorrentLabels('DIY HDR10+', '国语 中字', '', 'Dolby Vision');
    assert.equal(labels.diy, true);
    assert.equal(labels.hdr10plus, true);
    assert.equal(labels.gy, true);
    assert.equal(labels.zz, true);
    assert.equal(labels.db, true);
    assert.equal(labels.yy, false);
});

test('disc comparison keeps the original resolution and size rules', function () {
    assert.equal(npDiscMatches({ is4K: true, sizeGB: 60 }, { is4K: true, sizeGB: 10 }), true);
    assert.equal(npDiscMatches({ is4K: true, sizeGB: 60 }, { is4K: false, sizeGB: 58 }), true);
    assert.equal(npDiscMatches({ is4K: true, sizeGB: 60 }, { is4K: false, sizeGB: 20 }), false);
    assert.equal(npDiscMatches({ is4K: true, sizeGB: 0 }, { is4K: false, sizeGB: 0 }), true);
    assert.equal(looseDiscMatches({ is4K: false, sizeGB: 40 }, { is4K: true, sizeGB: 42 }, 2.5), true);
    assert.equal(looseDiscMatches({ is4K: false, sizeGB: 40 }, { is4K: true, sizeGB: 50 }, 3), false);
    assert.equal(looseDiscMatches({ is4K: undefined, sizeGB: 0 }, { is4K: false, sizeGB: 0 }, 2.5), false);
});
