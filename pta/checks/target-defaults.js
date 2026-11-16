/* 目标站必填默认值夹具：地区按源地区/语言对选项，媒介按标题对选项。
   纯函数夹具，不联网。 */
const path = require('path');
const td = require(path.join(__dirname, '..', 'server', 'target-defaults.js'));

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

const REGION = [
  { value: '1', label: '大陆 (CHN)' },
  { value: '2', label: '香港 (HKG,CHN)' },
  { value: '3', label: '台湾 (TWN,CHN)' },
  { value: '4', label: '英美 (ENG)' },
  { value: '5', label: '韩国 (KOR)' },
  { value: '6', label: '日本 (JPN)' },
  { value: '7', label: '印度 (IND)' }
];
const REGION_PTC = [
  { value: '1', label: '大陆 (Mainland,CHN)' },
  { value: '2', label: '香港 (HKG,CHN)' },
  { value: '3', label: '台湾 (TWN,CHN)' },
  { value: '4', label: '欧美 (Western)' },
  { value: '5', label: '韩国 (KOR)' },
  { value: '6', label: '日本 (JPN)' },
  { value: '7', label: '印度 (IND)' },
  { value: '8', label: '其它 (Other)' }
];
const MEDIA_PTC = [
  { value: '0', label: '请选择' },
  { value: '1', label: 'UHD Discs' },
  { value: '2', label: 'BD Discs' },
  { value: '3', label: 'Remux' },
  { value: '4', label: 'HDTV' },
  { value: '5', label: 'WEB-DL' },
  { value: '6', label: 'Encode' },
  { value: '7', label: 'DVD Discs' }
];
const MEDIA = [
  { value: '1', label: 'UltraHD(4K)' },
  { value: '2', label: 'Blu-ray' },
  { value: '3', label: 'Remux' },
  { value: '4', label: 'HDTV' },
  { value: '5', label: 'WEB-DL' },
  { value: '6', label: 'Encode' },
  { value: '7', label: 'DVD' }
];

check('地区选项代码取括号里第一个', function () {
  need(td.optionCode('大陆 (CHN)') === 'CHN', '大陆解析错');
  need(td.optionCode('香港 (HKG,CHN)') === 'HKG', '香港应取 HKG');
  need(td.optionCode('台湾 (TWN,CHN)') === 'TWN', '台湾应取 TWN');
});

check('地区按源地区映射', function () {
  need(td.betterDefault(REGION, { region: '美国' }) === '4', '美国应为英美');
  need(td.betterDefault(REGION, { region: '香港' }) === '2', '香港不对');
  need(td.betterDefault(REGION, { region: '日本' }) === '6', '日本不对');
  need(td.betterDefault(REGION, { region: '大陆' }) === '1', '大陆不对');
});

check('地区按语言/标题映射', function () {
  need(td.betterDefault(REGION, { title: 'Movie 2024 国语中字' }) === '1', '国语应为大陆');
  need(td.betterDefault(REGION, { title: 'Movie 2024 粤语' }) === '2', '粤语应为香港');
  need(td.betterDefault(REGION, { title: 'Anime 2024 日语' }) === '6', '日语应为日本');
});

check('媒介按标题映射', function () {
  need(td.betterDefault(MEDIA, { title: 'Resident Evil 2026 1080p Bluray AVC' }) === '2', '1080p Bluray 应为 Blu-ray');
  need(td.betterDefault(MEDIA, { title: 'Movie 2019 2160p UHD Blu-ray HEVC' }) === '1', 'UHD 应为 UltraHD');
  need(td.betterDefault(MEDIA, { title: 'Movie 2019 1080p Remux AVC' }) === '3', 'Remux 应为 Remux');
  need(td.betterDefault(MEDIA, { title: 'Show 2020 1080p WEB-DL' }) === '5', 'WEB-DL 不对');
});

check('站点自己的写法也能对上', function () {
  need(td.betterDefault(REGION_PTC, { region: '大陆' }) === '1', 'Mainland 应识别为 CHN');
  need(td.betterDefault(REGION_PTC, { region: '美国' }) === '4', 'Western 应识别为 ENG');
  need(td.betterDefault(MEDIA_PTC, { title: 'Movie 2020 1080p Blu-ray' }) === '2', 'BD Discs 应识别为 Blu-ray');
  need(td.betterDefault(MEDIA_PTC, { title: 'Movie 2020 2160p UHD Blu-ray' }) === '1', 'UHD Discs 不对');
});

check('简介里的制片/产地/语言优先', function () {
  const korean = { descrBb: '* 片 名 狂唱下半场\n* 制 片 韩国\n* 语 言 韩语' };
  need(td.regionCodeOf(korean) === 'KOR', '韩国制片没识别出来');
  const sweden = { descrBb: '◎产　　地　瑞典\n◎语　　言　瑞典语' };
  need(td.regionCodeOf(sweden) === 'ENG', '瑞典应归欧美');
  const chinese = { descrBb: '◎产　　地　中国大陆\n◎语　　言　国语' };
  need(td.regionCodeOf(chinese) === 'CHN', '大陆没识别出来');
});

check('认不出就返回空，交给站点默认值', function () {
  need(td.betterDefault(REGION, {}) === '', '空条目不该硬猜地区');
  need(td.betterDefault(MEDIA, {}) === '', '空条目不该硬猜媒介');
});

for (const [ok, name, why] of results) console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '  → ' + why));
const failed = results.filter(function (r) { return !r[0]; }).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
process.exit(failed ? 1 : 0);
