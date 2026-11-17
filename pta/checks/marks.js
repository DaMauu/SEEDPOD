/* 限制芯片逐项回归：禁转 / 限转 / HR / 独占 / DIY 都要能独立命中，互不误伤。 */
const marks = require('../server/marks');
const rowTagLib = require('../server/adapters/row-tags');
const rowTags = rowTagLib.rowTags;

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

check('标题文字识别四种标记', () => {
  const a = marks.marksOf('Movie 2024 1080p 禁转');
  need(a.noRedistribute === true, '禁转没识别');
  const b = marks.marksOf('Movie 2024 1080p 限转');
  need(b.limited === true, '限转没识别');
  const c = marks.marksOf('Movie 2024 1080p 独占');
  need(c.exclusive === true, '独占没识别');
  const d = marks.marksOf('Movie 2024 1080p DIY');
  need(d.diy === true, 'DIY 没识别');
});

check('行内标签识别：H&R / Exclusive / 中文', () => {
  const tags = rowTags('<span class="tag" title="H&amp;R">H&amp;R</span><span class="tag">独占</span>');
  need(tags.indexOf('HR') >= 0, 'H&R 属性没识别：' + JSON.stringify(tags));
  need(tags.indexOf('独占') >= 0, '独占文字没识别：' + JSON.stringify(tags));
  const ex = rowTags('<span class="torrent-search--list__tag">Exclusive</span>');
  need(ex.indexOf('独占') >= 0, 'Exclusive 没归一成独占：' + JSON.stringify(ex));
  const diy = rowTags('<span class="tag">DIY</span>');
  need(diy.indexOf('DIY') >= 0, 'DIY 没识别');
});

check('站内字段名不当标签：tag_exclusive 只算禁转', () => {
  const tags = rowTags('<a class="torrents-tag" href="torrents.php?tag_exclusive=yes">禁转</a>');
  need(tags.indexOf('禁转') >= 0, '禁转文字没识别：' + JSON.stringify(tags));
  need(tags.indexOf('独占') < 0, 'href 里的 tag_exclusive 被误判成独占：' + JSON.stringify(tags));
  const detail = rowTagLib.detailTags('<a class="sb-tag" href="torrents.php?tag_exclusive=yes">禁转</a><h1>Foo 2024</h1>');
  need(detail.length === 0, '全站筛选标签被算进详情：' + JSON.stringify(detail));
});

check('详情页只认详情标签和标题括号', () => {
  const html = '<a class="sb-tag" href="torrents.php?tag_exclusive=yes">禁转</a>'
    + '<h1>Foo 2024 <b>[<font color="red">禁转</font>]</b></h1>'
    + '<a class="chs_tag details-tag" href="torrents.php?tag_exclusive=yes">禁转</a>'
    + '<a class="details-tag" href="torrents.php?tag_doityourself=yes">DIY原盘</a>';
  const tags = rowTagLib.detailTags(html);
  need(tags.indexOf('禁转') >= 0 && tags.indexOf('DIY') >= 0, '详情标签没识别：' + JSON.stringify(tags));
  need(tags.indexOf('独占') < 0, '详情 href 被误判成独占：' + JSON.stringify(tags));
});

check('纯文本不把 URL 当标签', () => {
  const tags = rowTagLib.textTags('https://example.org/torrents.php?tag_exclusive=yes&tag_doityourself=yes');
  need(tags.length === 0, 'URL 被当成标签：' + JSON.stringify(tags));
});

check('HR 边界：HR-HDTV 不算 H&R', () => {
  const t1 = rowTags('<span class="tag">HR-HDTV</span>');
  need(t1.indexOf('HR') < 0, 'HR-HDTV 被误判：' + JSON.stringify(t1));
  const t2 = rowTags('<span class="tag">[HR]</span>');
  need(t2.indexOf('HR') >= 0, '[HR] 没识别');
  const t3 = rowTags('<img class="hitandrun" src="x.png">');
  need(t3.indexOf('HR') >= 0, 'hitandrun class 没识别');
});

check('五个芯片各自只命中对应条目', () => {
  const items = {
    plain: { title: 'Plain 2024 1080p' },
    noRedistribute: { title: 'NoRedistribute 2024 1080p 禁转' },
    limited: { title: 'Limited 2024 1080p 限转', addedAt: new Date(Date.now() - 2 * 86400000).toISOString() },
    hr: { title: 'HR 2024 1080p', tags: 'HR' },
    exclusive: { title: 'Exclusive 2024 1080p', tags: '独占' },
    diy: { title: 'DIY 2024 1080p', tags: 'DIY' }
  };
  const hit = (chip) => Object.keys(items).filter((k) => marks.matchesLimit(items[k], [chip], Date.now()));
  need(JSON.stringify(hit('禁转')) === JSON.stringify(['noRedistribute']), '禁转命中不对：' + JSON.stringify(hit('禁转')));
  need(JSON.stringify(hit('限转')) === JSON.stringify(['limited']), '限转命中不对：' + JSON.stringify(hit('限转')));
  need(JSON.stringify(hit('HR')) === JSON.stringify(['hr']), 'HR 命中不对：' + JSON.stringify(hit('HR')));
  need(JSON.stringify(hit('独占')) === JSON.stringify(['exclusive']), '独占命中不对：' + JSON.stringify(hit('独占')));
  need(JSON.stringify(hit('DIY')) === JSON.stringify(['diy']), 'DIY 命中不对：' + JSON.stringify(hit('DIY')));
  need(hit('禁转').indexOf('hr') < 0, '禁转误伤 HR 条目');
  need(hit('HR').indexOf('plain') < 0, 'HR 误伤普通条目');
});

check('限转按发布时间算剩余天数', () => {
  const it = { title: 'Limited 2024 1080p 限转', addedAt: new Date(Date.now() - 2 * 86400000).toISOString() };
  const m = marks.effectiveMarks(it, Date.now());
  need(m.limited === true && Number(m.limitedDays) >= 4 && Number(m.limitedDays) <= 5, '剩余天数不对：' + JSON.stringify(m));
  const old = { title: 'Limited Old 2024 1080p 限转', addedAt: new Date(Date.now() - 30 * 86400000).toISOString() };
  need(!Number(marks.effectiveMarks(old, Date.now()).limitedDays || 0), '超过 7 天还算限转');
});

check('没选芯片时不过滤', () => {
  need(marks.matchesLimit({ title: 'Movie 禁转 限转 HR 独占 DIY' }, [], Date.now()) === false, '空选择还在过滤');
});

const pass = results.filter(function (r) { return r[0]; }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);
