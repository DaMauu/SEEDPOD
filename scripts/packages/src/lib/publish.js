import { RE } from './patterns.js';

export function inferSourceRegion(synopsisBbcode, standardName, customSubTitle) {
    var textToSearch = (synopsisBbcode + ' ' + standardName + ' ' + customSubTitle);
    if (/港版|香港/.test(textToSearch)) return '香港';
    if (/台版|台湾|臺灣/.test(textToSearch)) return '台湾';
    if (/国版|大陆|内地/.test(textToSearch)) return '大陆';
    if (/日版|日本/.test(textToSearch)) return '日本';
    if (/韩版|韩国/.test(textToSearch)) return '韩国';
    if (/印版|印度/.test(textToSearch)) return '印度';
    if (RE.US_EU.test(textToSearch)) return '欧美';
    return '欧美';
}

export function inferTorrentLabels(standardName, customSubTitle, synopsisBbcode, bdinfoText) {
    var combined = (standardName + ' ' + customSubTitle + ' ' + synopsisBbcode + ' ' + bdinfoText).toUpperCase();
    return {
        gy: /国语|国配|MANDARIN|CHINESE/i.test(combined),
        yy: /粤语|粤配|CANTONESE/i.test(combined),
        zz: /中字|中文|CHS|CHT/i.test(combined),
        yz: /英字|ENG|ENGLISH/i.test(combined),
        diy: /DIY/i.test(combined),
        hdr10: /HDR10\b/i.test(combined),
        hdr10plus: /HDR10\+/i.test(combined),
        db: /杜比视界|DOLBY VISION|DOVI/i.test(combined)
    };
}
