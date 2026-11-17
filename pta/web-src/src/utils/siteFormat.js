/* 站点列表/详情共用：架构标签、时间格式、登录状态。 */
export const ARCH = {
  NP: ['np', 'NexusPHP'], UNIT3D: ['u3d', 'UNIT3D'], GZ: ['gz', 'Gazelle'],
  OTHER: ['oth', '其它'], '?': ['unk', '未确认'], U3D: ['u3d', 'UNIT3D']
};

export function fmtWhen(raw) {
  if (!raw) return '—';
  const t = typeof raw === 'number' ? new Date(raw) : new Date(String(raw));
  if (isNaN(t.getTime())) return '—';
  const p2 = n => String(n).padStart(2, '0');
  const now = new Date();
  const sameDay = t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth() && t.getDate() === now.getDate();
  return (sameDay ? '今日 ' : p2(t.getMonth() + 1) + '-' + p2(t.getDate()) + ' ') + p2(t.getHours()) + ':' + p2(t.getMinutes());
}
export function archOf(site) { return ARCH[site.arch] || ARCH['?']; }
export function archCls(site) { return archOf(site)[0]; }
export function archLabel(site) { return archOf(site)[1]; }
export function dotCls(site) { return site.login === 'ok' ? 'ok' : site.login === 'fail' ? 'bad' : 'idle'; }
export function loginTxt(site) { return site.login === 'ok' ? '可用' : site.login === 'fail' ? '失效' : '未自检'; }
export function modeTxt(site) {
  if (!site.enabled) return '停用';
  if (site.mode === 'full') return '全量';
  if (site.mode === 'mixed') return '增量+定期全量';
  return '增量';
}
