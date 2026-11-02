import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fullSizeShot, isShotUrl, isDirectImageUrl, bbcodeShotUrls, unit3dDescriptionFromHtml } from '../src/lib/shots.js';

// Screenshot block in the shape Upload-Assistant writes on Blutopia.
const BLU_DESC = [
    '[center][url=https://ptpimg.me/a1b2c3.png][img=350]https://ptpimg.me/a1b2c3.png[/img][/url] ',
    '[url=https://onlyimage.org/image/XyZ][img=350]https://img.onlyimage.org/XyZ.png[/img][/url] ',
    '[url=https://imgbox.com/AbCd][img]https://thumbs2.imgbox.com/aa/bb/AbCd_t.png[/img][/url]',
    '[img width=400]https://i.lensdump.com/i/Q1w2E3.png[/img][/center]',
    '[center][url=https://github.com/Audionut/Upload-Assistant][img=80]https://ptpimg.me/606tk4.png[/img][/url][/center]'
].join('\n');

test('bbcodeShotUrls reads sized [img] tags and skips the uploader badge', function () {
    assert.deepEqual(bbcodeShotUrls(BLU_DESC), [
        'https://ptpimg.me/a1b2c3.png',
        'https://img.onlyimage.org/XyZ.png',
        'https://thumbs2.imgbox.com/aa/bb/AbCd_t.png',
        'https://i.lensdump.com/i/Q1w2E3.png'
    ]);
});

test('fullSizeShot unwraps the UNIT3D wsrv.nl image proxy', function () {
    var proxied = 'https://wsrv.nl/?n=-1&ll&url=' + encodeURIComponent('https://ptpimg.me/a1b2c3.png');
    assert.equal(fullSizeShot(proxied), 'https://ptpimg.me/a1b2c3.png');
    assert.equal(fullSizeShot('https://images.weserv.nl/?url=' + encodeURIComponent('https://t12.pixhost.to/thumbs/1/x.png')), 'https://img12.pixhost.to/images/1/x.png');
    assert.equal(fullSizeShot('//i.ibb.co/x/y.md.png', 'https:'), 'https://i.ibb.co/x/y.png');
    assert.equal(fullSizeShot('https://i.ibb.co/x/y.md.webp'), 'https://i.ibb.co/x/y.webp');
    assert.equal(fullSizeShot('https://images.weserv.nl/?url=ssl:ptpimg.me/x.png'), 'https://ptpimg.me/x.png');
    assert.equal(fullSizeShot('https://wsrv.nl/?url=' + encodeURIComponent('https://utp.pm/i/a.png?x=1&amp;y=2')), 'https://utp.pm/i/a.png?x=1&y=2');
    assert.equal(fullSizeShot('data:image/png;base64,AAAA'), '');
});

test('links count only when they point at the image file', function () {
    assert.equal(isDirectImageUrl('https://ptpimg.me/a1b2c3.png'), true);
    assert.equal(isDirectImageUrl('https://imgbox.com/AbCd'), false);
    assert.equal(isDirectImageUrl('https://pixhost.to/show/1/x.png'), false);
    assert.equal(isShotUrl('https://pterclub.net/pic/CS.png'), false);
    assert.equal(isShotUrl('https://blutopia.cc/img/logo.png'), false);
});

test('unit3dDescriptionFromHtml decodes the Copy button payload', function () {
    var raw = '◎片名 测试\n' + BLU_DESC;
    var b64 = Buffer.from(raw, 'utf8').toString('base64');
    var html = '<div class="panel__body bbcode-rendered"><img src="https://wsrv.nl/?n=-1&amp;ll&amp;url=x"></div>' +
        '<script nonce="n">document.addEventListener(\'alpine:init\', () => { Alpine.data(\'description\', () => ({ copy() {' +
        ' text.innerHTML = decodeURIComponent(escape(atob(\'' + b64 + '\'))); } })); });</script>';
    assert.equal(unit3dDescriptionFromHtml(html), raw);
    assert.equal(unit3dDescriptionFromHtml('<script>atob(\'' + b64 + '\')</script>'), '');
});
