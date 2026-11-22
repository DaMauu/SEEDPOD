/* 单条队列条目的目标站查重：调度、送审共用同一套状态写回。
   目标站失败不当作“没重复”，必须留下错误并等下一轮。 */
function hostsOf(item, fallback) {
  const out = [];
  [fallback, item && item.targetSite].concat(item && Array.isArray(item.targets) ? item.targets : []).forEach(function (h) {
    h = String(h || '').trim().toLowerCase();
    if (h && out.indexOf(h) < 0) out.push(h);
  });
  return out;
}

async function dedupeItem(o) {
  const item = o.item;
  const hosts = Array.isArray(o.hosts) && o.hosts.length ? o.hosts : hostsOf(item, o.fallback);
  const targetService = o.targetService;
  const now = o.now || function () { return new Date().toISOString(); };
  const bumpSiteFail = o.bumpSiteFail || function () {};
  const resetSiteFail = o.resetSiteFail || function () {};
  const out = { hosts: hosts, checked: 0, found: 0, skipped: 0, errors: [], disabled: false };
  item.dupeResults = item.dupeResults && typeof item.dupeResults === 'object' ? item.dupeResults : {};
  let anyOpen = false;

  for (const host of hosts) {
    const prev = item.dupeResults[host];
    if (item.dupePassedAt && prev && !prev.skip) { anyOpen = true; continue; }
    out.checked++;
    let chk = null;
    try {
      chk = await targetService.checkDupe(host, item, null);
      if (chk && chk.ok === false) throw Object.assign(new Error(chk.message || chk.code), { code: chk.code });
      resetSiteFail(host);
    } catch (e) {
      const msg = String(e && e.message || e).slice(0, 160);
      out.errors.push({ host: host, code: (e && e.code) || 'TARGET_UNREACHABLE', message: msg });
      bumpSiteFail(host, '查重失败：' + msg);
      item.dedupeAttempts = (Number(item.dedupeAttempts) || 0) + 1;
      item.dedupeLastAttemptAt = now();
      item.dedupeLastErrorCode = (e && e.code) || 'TARGET_UNREACHABLE';
      item.dedupeLastError = msg;
      item.dedupeNextRetryAt = new Date(Date.now() + 15 * 60000).toISOString();
      anyOpen = true;
      continue;
    }
    if (chk && chk.disabled) { out.disabled = true; anyOpen = true; continue; }
    delete item.dedupeLastError;
    delete item.dedupeLastErrorCode;
    delete item.dedupeNextRetryAt;
    item.dupeResults[host] = { found: !!chk.found, skip: !!chk.skip, kind: chk.kind || '', at: now() };
    if (chk.found && chk.skip) { out.skipped++; continue; }
    if (chk.found) out.found++;
    anyOpen = true;
  }
  out.allSkipped = !anyOpen;
  return out;
}

module.exports = { dedupeItem, hostsOf };
