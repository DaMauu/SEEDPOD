import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildImdbCacheKey, isFreshLibraryHit, libraryStorageKey, trimLibrary } from '../src/lib/library.js';
import {
    listingKey,
    isCheckpointRecord,
    isCheckpointUsable,
    serializeItem,
    itemIdentity,
    mergeBatchItem,
    copyRestoredImdbId,
    splitBatchByLibrary,
    nextNetworkDelay,
    CHECKPOINT_MAX_AGE_MS
} from '../src/lib/batch.js';

const HOUR = 60 * 60 * 1000;

function entry(ageMs, result) {
    return { lastCheck: 1_000_000 - ageMs, lastResult: result };
}

test('fresh library hits ignore errors and expired rows', function () {
    var now = 1_000_000;
    assert.equal(isFreshLibraryHit(entry(HOUR, { hasUntouchedDupe: false }), now, 24 * HOUR), true);
    assert.equal(isFreshLibraryHit(entry(HOUR, { isError: true, errorMsg: 'HTTP 429' }), now, 24 * HOUR), false);
    assert.equal(isFreshLibraryHit(entry(25 * HOUR, { hasUntouchedDupe: true }), now, 24 * HOUR), false);
    assert.equal(isFreshLibraryHit(null, now, 24 * HOUR), false);
});

test('splitBatchByLibrary skips only fresh successful checks', function () {
    var now = 1_000_000;
    var host = 'pterclub.net';
    var done = { imdbId: 'tt0109558', movieTitle: 'The Dark Half', is4K: false };
    var failed = { imdbId: 'tt0110912', movieTitle: 'Pulp Fiction', is4K: false };
    var fresh = { imdbId: 'tt0068646', movieTitle: 'The Godfather', is4K: true };
    var library = {};
    library[libraryStorageKey(host, buildImdbCacheKey(done))] = entry(HOUR, { hasUntouchedDupe: true, matchedTitle: 'Dark Half' });
    library[libraryStorageKey(host, buildImdbCacheKey(failed))] = entry(HOUR, { isError: true, errorMsg: 'HTTP 429' });
    var plan = splitBatchByLibrary([done, failed, fresh], library, {
        bSiteHost: host,
        now: now,
        freshMs: 24 * HOUR,
        enabled: true
    });
    assert.equal(plan.skipped.length, 1);
    assert.equal(plan.skipped[0].item.movieTitle, 'The Dark Half');
    assert.deepEqual(plan.pending.map(function (row) { return row.item.movieTitle; }), ['Pulp Fiction', 'The Godfather']);
    assert.equal(splitBatchByLibrary([done], library, { bSiteHost: host, now: now, freshMs: 24 * HOUR, enabled: false }).pending.length, 1);
});

test('trimLibrary drops the oldest unprotected rows and keeps an open batch', function () {
    var library = {};
    for (var i = 0; i < 12; i++) library['k' + i] = { lastCheck: i + 1 };
    trimLibrary(library, 10, { k0: true });
    assert.equal(library.k0.lastCheck, 1);
    assert.equal(library.k1, undefined);
    assert.equal(library.k2, undefined);
    assert.equal(Object.keys(library).length, 10);

    var pinned = {};
    for (var j = 0; j < 12; j++) pinned['p' + j] = { lastCheck: j };
    var protect = {};
    Object.keys(pinned).forEach(function (key) { protect[key] = true; });
    trimLibrary(pinned, 10, protect);
    assert.equal(Object.keys(pinned).length, 12);
});

test('checkpoint identity ignores the page number and rejects other lists', function () {
    var href = 'https://blutopia.cc/torrents?page=4&perPage=100&name=dark';
    assert.equal(listingKey(href), listingKey('https://blutopia.cc/torrents?name=dark&perPage=100&page=1'));
    assert.notEqual(listingKey(href), listingKey('https://blutopia.cc/torrents?name=other&perPage=100'));
    var now = 5_000_000;
    var cp = {
        v: 1,
        siteAHost: 'blutopia.cc',
        siteBHost: 'pterclub.net',
        listKey: listingKey(href),
        savedAt: now - 1000,
        phase: 'check',
        items: [{ torrentId: '9' }]
    };
    var ctx = { siteAHost: 'blutopia.cc', siteBHost: 'pterclub.net', listKey: cp.listKey };
    assert.equal(isCheckpointUsable(cp, ctx, now, CHECKPOINT_MAX_AGE_MS), true);
    assert.equal(isCheckpointUsable(cp, Object.assign({}, ctx, { siteBHost: 'hdsky.me' }), now, CHECKPOINT_MAX_AGE_MS), false);
    assert.equal(isCheckpointRecord(Object.assign({}, cp, { savedAt: now - CHECKPOINT_MAX_AGE_MS - 1 }), now, CHECKPOINT_MAX_AGE_MS), false);
    assert.equal(isCheckpointRecord(Object.assign({}, cp, { phase: 'done' }), now, CHECKPOINT_MAX_AGE_MS), false);
});

test('mergeBatchItem keeps a stored imdb id when the live row has none', function () {
    var merged = mergeBatchItem(
        { torrentId: '1', imdbId: 'tt0109558', movieTitle: 'The Dark Half' },
        { torrentId: '1', imdbId: '', movieTitle: 'The Dark Half', row: { id: 'live' } }
    );
    assert.equal(merged.imdbId, 'tt0109558');
    assert.equal(merged.row.id, 'live');
    var replaced = mergeBatchItem(
        { torrentId: '1', imdbId: 'tt0109558' },
        { torrentId: '1', imdbId: 'tt0110912' }
    );
    assert.equal(replaced.imdbId, 'tt0110912');
    var live = { torrentId: '1', imdbId: '' };
    copyRestoredImdbId(live, merged);
    assert.equal(live.imdbId, 'tt0109558');
});

test('serializeItem keeps resume fields and drops live dom objects', function () {
    var raw = {
        torrentId: '42',
        movieTitle: 'The Dark Half',
        movieYear: '1993',
        imdbId: 'tt0109558',
        sizeGB: 45.2,
        is4K: false,
        downloadUrl: 'https://example/download.php?id=42',
        bdinfo: 'Disc Title: HUGE',
        row: { nodeType: 1 },
        chkBox: { checked: true }
    };
    var saved = serializeItem(raw);
    assert.equal(saved.torrentId, '42');
    assert.equal(saved.bdinfo, undefined);
    assert.equal(saved.row, undefined);
    assert.equal(saved.chkBox, undefined);
    assert.equal(itemIdentity(raw), '42');
    assert.equal(itemIdentity({ movieTitle: 'Nope', movieYear: '2022' }), 'Nope_2022');
});

test('network delay rests every 15 requests and backs off after failures', function () {
    assert.equal(nextNetworkDelay(2500, 14, 'ok'), 2500);
    assert.equal(nextNetworkDelay(2500, 15, 'ok'), 5500);
    assert.equal(nextNetworkDelay(2500, 1, 'error'), 5000);
    assert.equal(nextNetworkDelay(2500, 1, 'rateLimit'), 12000);
    assert.equal(nextNetworkDelay(8000, 1, 'error'), 16000);
    assert.equal(nextNetworkDelay(9000, 1, 'rateLimit'), 30000);
});
