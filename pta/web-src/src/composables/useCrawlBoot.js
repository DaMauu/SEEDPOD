import { onMounted, onUnmounted } from 'vue'
import { loggedIn, viewVisible } from '../utils/ui'

/* 页面启动：首次进入和 hashchange 时补齐站点/闸门/流程；只跑一次加载。 */
export function useCrawlBoot(opts) {
  const sites = opts.sites
  const gates = opts.gates
  const loadSites = opts.loadSites
  const loadGates = opts.loadGates
  const loadFlow = opts.loadFlow

  async function ensureCrawlPage() {
    if (!viewVisible('crawl') || !loggedIn()) return
    if (!sites.value.length) await loadSites()
    if (!gates.loaded) await loadGates()
    loadFlow()
  }
  onMounted(() => {
    window.addEventListener('hashchange', ensureCrawlPage)
    ensureCrawlPage()
  })
  onUnmounted(() => {
    window.removeEventListener('hashchange', ensureCrawlPage)
  })
  return { ensureCrawlPage }
}
