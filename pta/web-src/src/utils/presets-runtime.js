/* 全局预设运行时：首屏用打包默认值，登录后以 data/presets.json 为准。 */
import { ref } from 'vue'
import base from '../../shared/presets.json'

export const runtimePresets = ref(base)
let loading = null

function chipsOf(obj) { return Object.keys(obj || {}).map(function (k) { return obj[k] }) }

/* 把后端预设写回流程页的 chips；用户新增的类型也能出现 */
export function applyPresetChips(rules, presets) {
  const rows = (((rules || {}).fetch || [])[0] || {}).rows || []
  const map = {
    '类型': (presets.types) || {},
    '媒介': ((presets.search || {}).medium) || {},
    '分辨率': ((presets.search || {}).resolution) || {},
    '优惠': ((presets.search || {}).discount) || {},
    '限制': ((presets.search || {}).restriction) || {}
  }
  rows.forEach(function (r) { if (r && map[r.t]) r.chips = chipsOf(map[r.t]) })
}

export function loadRuntimePresets(force) {
  if (loading && !force) return loading
  loading = fetch('/api/presets', { credentials: 'same-origin' }).then(function (r) {
    return r.ok ? r.json() : null
  }).then(function (j) {
    if (j && j.ok && j.data && j.data.types && Object.keys(j.data.types).length) {
      runtimePresets.value = j.data
      applyPresetChips(window.PTA_RULES || {}, j.data)
      window.dispatchEvent(new Event('pta-presets'))
    }
    return runtimePresets.value
  }).catch(function () { return runtimePresets.value })
  return loading
}
