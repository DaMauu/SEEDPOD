import { computed, ref } from 'vue'

export function useCrawlSites(opts) {
  const getJson = opts.getJson
  const patchUser = opts.patchUser
  const toast = opts.toast
  const reportError = opts.reportError
  const loadTypes = opts.loadTypes
  const loadSched = opts.loadSched
  const sourceHost = opts.sourceHost
  const targetHost = opts.targetHost

  const sites = ref([])
  const siteStatus = ref({})
  const siteCfg = ref({})
  const targetOpen = ref(false)
  const targetQ = ref('')
  const siteOptions = computed(() => sites.value.map(s => ({ host: s.host, title: s.title || s.host })))
  const targetSite = computed(() => sites.value.find(s => s.host === targetHost.value) || null)
  const targetOptions = computed(() => {
    const q = targetQ.value.trim().toLowerCase()
    const score = s => (siteCfg.value[s.host] && siteCfg.value[s.host].enabled === false ? 0 : 2) + (siteStatus.value[s.host] && siteStatus.value[s.host].pass ? 1 : 0)
    return sites.value.slice()
      .sort((a, b) => score(b) - score(a) || String(a.title || a.host).localeCompare(String(b.title || b.host), 'zh-CN'))
      .filter(s => !q || ((s.title || '') + ' ' + s.host).toLowerCase().includes(q))
      .map(s => ({ host: s.host, title: s.title || s.host }))
  })

async function loadSites() {
  const [sj, cj] = await Promise.all([getJson('/api/sites'), getJson('/api/site-config')])
  if (sj && sj.ok) {
    sites.value = Array.isArray(sj.data.sites) ? sj.data.sites : []
    siteStatus.value = sj.data.status || {}
  }
  if (cj && cj.ok) siteCfg.value = cj.data.sites || {}
  try {
    sourceHost.value = localStorage.getItem('pta.crawlSite') || ''
    targetHost.value = localStorage.getItem('pta.target') || ''
  } catch (e) { reportError('Crawl', e) }
  if (!siteOptions.value.some(s => s.host === sourceHost.value)) sourceHost.value = ''
  if (targetHost.value && !sites.value.some(s => s.host === targetHost.value)) targetHost.value = ''
  loadTypes()
  loadSched()
  if (!siteOptions.value.some(s => s.host === targetHost.value)) targetHost.value = ''
}

function saveSource() {
  try { localStorage.setItem('pta.crawlSite', sourceHost.value) } catch (e) { reportError('Crawl', e) }
  loadTypes()
}

function pickTarget(host) {
  targetHost.value = host
  patchUser({ targetHost: host })
  try { localStorage.setItem('pta.target', host) } catch (e) { reportError('Crawl', e) }
  targetOpen.value = false
  toast('发布目标改为：' + ((targetSite.value && targetSite.value.title) || host))
}

  return { sites, siteStatus, siteCfg, targetOpen, targetQ, siteOptions, targetSite, targetOptions, loadSites, saveSource, pickTarget };
}
