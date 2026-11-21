/* 发布前的目标站就绪检查：prepared 里没有目标 / ready=false 就拦。 */
function targetReady(item) {
  const it = item || {};
  if (!it.prepared) return { ok: true };
  const list = Array.isArray(it.prepared.targets) ? it.prepared.targets : [];
  const want = String(it.targetSite || '').toLowerCase();
  const hit = list.filter(function (x) { return x && String(x.host || '').toLowerCase() === want; })[0];
  const tp = hit ? hit.target : (String(it.prepared.targetHost || '').toLowerCase() === want ? it.prepared.target : null);
  if (!tp || tp.ready === false) return { ok: false, message: '目标站还没就绪：先补分类/映射或重跑终审' };
  return { ok: true };
}
module.exports = { targetReady };
