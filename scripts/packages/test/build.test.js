import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildUserscript } from '../scripts/build.mjs';

test('esbuild emits one Greasemonkey script with the metadata header', async function () {
    await buildUserscript();
    var file = resolve('dist/pt-bluray-assistant.user.js');
    var source = readFileSync(file, 'utf8');
    assert.equal(source.startsWith('// ==UserScript==\n'), true);
    assert.match(source, /@name\s+PT 原盘转载发布与智能查重助手/);
    assert.match(source, /@version\s+7\.9\.0/);
    assert.match(source, /@grant\s+GM_xmlhttpRequest/);
    assert.match(source, /@grant\s+GM_setValue/);
    assert.match(source, /GM_getValue\(/);
    assert.match(source, /GM_xmlhttpRequest\(/);
    assert.match(source, /unsafeWindow/);
    assert.match(source, /词库秒过/);
    assert.doesNotMatch(source, /^import /m);
    assert.doesNotMatch(source, /from '\.\/lib\//);
    var headerEnd = source.indexOf('// ==/UserScript==');
    assert.equal(headerEnd > 0, true);
    assert.equal(source.indexOf('function') > headerEnd, true);
});
