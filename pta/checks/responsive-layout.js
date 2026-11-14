/* 响应式布局检查：临时后端 + 真实 dist + 登录后逐页量宽度。
   覆盖 360 / 390 / 768 / 1280；只查布局，不发真实站请求。 */
const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { DatabaseSync } = require('node:sqlite')
const { loadPlaywright, launchChromium } = require('./browser')

const ROOT = path.resolve(__dirname, '..')
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-responsive-'))
const DATA = path.join(TMP_ROOT, 'data')
fs.mkdirSync(DATA)
const PORT = Number(process.env.PTA_RESPONSIVE_PORT || 8092)
const BASE = 'http://127.0.0.1:' + PORT
const USER = 'admin'
const PASS = 'demo-pass'
const WIDTHS = [360, 390, 768, 1280]
const failures = []
const passes = []
const { chromium } = loadPlaywright()

function fail(where, msg) { failures.push(where + ' · ' + msg) }
function ok(where, msg) { passes.push(where + ' · ' + msg) }
function need(where, cond, msg) { if (!cond) fail(where, msg) }

async function waitUp() {
  const end = Date.now() + 10000
  while (Date.now() < end) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return } catch (e) {}
    await new Promise(r => setTimeout(r, 120))
  }
  throw new Error('临时后端没起来')
}

function seedDb() {
  const db = new DatabaseSync(path.join(DATA, 'seedpod.db'))
  db.exec(`CREATE TABLE IF NOT EXISTS sites (host TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT);
    CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, level TEXT, src TEXT, msg TEXT);`)
  const now = new Date().toISOString()
  const ins = db.prepare('INSERT OR REPLACE INTO sites(host, data, updated_at) VALUES(?, ?, ?)')
  for (let i = 1; i <= 305; i++) {
    const host = 'site-' + String(i).padStart(3, '0') + '.example'
    const title = i === 1 ? '这是一个比较长的站点名称示例' : '测试站点 ' + String(i).padStart(3, '0')
    ins.run(host, JSON.stringify({ url: 'https://' + host + '/index.php', arch: i % 3 === 0 ? 'UNIT3D' : (i % 3 === 1 ? 'NP' : 'GZ'), title, base: true }), now)
  }
  const log = db.prepare('INSERT INTO logs(ts, level, src, msg) VALUES(?, ?, ?, ?)')
  const logs = [
    ['info', '调度', '定时抓取已关闭'],
    ['warn', '发布', '目标站上传页未识别到表单，已跳过'],
    ['error', '下载器', 'qBittorrent 连接超时，稍后重试'],
    ['info', '查重', '本地库比对完成'],
    ['warn', '站点', '站点 cookie 还有 2 天过期'],
    ['error', '发布', '真发布默认关闭，未发送请求']
  ]
  logs.forEach(function (x, i) { log.run(new Date(Date.now() - i * 60000).toISOString(), x[0], x[1], x[2]) })
  db.close()

  fs.writeFileSync(path.join(DATA, 'site-status.json'), JSON.stringify({
    'site-001.example': { pass: true },
    'site-002.example': { pass: true },
    'site-003.example': { pass: true }
  }))
  fs.copyFileSync(path.join(ROOT, '..', 'CHANGELOG.md'), path.join(TMP_ROOT, 'CHANGELOG.md'))
}

async function run() {
  seedDb()
  const dist = path.join(ROOT, 'web', 'dist')
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    console.error('没有 dist，先 npm run build')
    process.exit(2)
  }
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'app-fastify.js')], {
    cwd: path.join(ROOT, '..'),
    env: Object.assign({}, process.env, {
      PTA_PORT: String(PORT), PTA_DATA: DATA, PTA_WEB: dist,
      PTA_USER: USER, PTA_PASS: PASS
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let out = ''
  child.stdout.on('data', d => { out += d })
  child.stderr.on('data', d => { out += d })
  let browser
  try {
    await waitUp()
    browser = await launchChromium(chromium)
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    const pageErrors = []
    page.on('pageerror', e => pageErrors.push(e.message))
    await page.addInitScript(() => { try { localStorage.setItem('pta.mode', 'dev') } catch (e) {} })

    await page.goto(BASE + '/#dashboard', { waitUntil: 'load' })
    await page.waitForTimeout(700)
    if (await page.locator('#login-mask').isVisible().catch(() => false)) {
      await page.fill('#login-user', USER)
      await page.fill('#login-pass', PASS)
      await page.click('#login-submit')
      await page.waitForSelector('#login-mask', { state: 'detached', timeout: 8000 })
      await page.waitForTimeout(500)
    }

    await page.evaluate(async () => {
      await fetch('/api/catalog', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: [
          { title: '响应式检查词条 2024 2160p UHD Blu-ray HEVC TrueHD 7.1 超长标题测试', site: 'site-001.example', res: '2160p', size: '61.8 GB', cat: 'movie', status: 'new' },
          { title: '响应式检查词条 2023 1080p Blu-ray AVC DTS-HD MA', site: 'site-002.example', res: '1080p', size: '22.4 GB', cat: 'movie', status: 'selected' },
          { title: '响应式检查词条 2022 1080i HDTV', site: 'site-003.example', res: '1080i', size: '8.1 GB', cat: 'tv', status: 'archived' }
        ] })
      })
      await fetch('/api/queue', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: '响应式检查待审核标题 2024 2160p UHD Blu-ray HEVC TrueHD 7.1',
          cn: '响应式待审核布局测试标题',
          intro: '这里是待审核页的简介文字，用来检查卡片和按钮布局是否正常。',
          site: 'site-001.example', targetSite: 'site-002.example', status: 'pending',
          cat: 'movie', res: '2160p', size: '61.8 GB', shots: ['a.jpg', 'b.jpg', 'c.jpg'], anonymous: false
        })
      })
      for (const [name, url] of [['qB One', 'http://127.0.0.1:1'], ['qB Two', 'http://127.0.0.1:2']]) {
        await fetch('/api/downloaders', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, url, user: 'demo', pass: 'demo' })
        })
      }
    })

    const goto = async (view) => {
      await page.evaluate(v => { location.hash = '#' + v }, view)
      await page.waitForTimeout(800)
      await page.evaluate(() => { document.body.scrollTop = 0; window.scrollTo(0, 0) })
    }

    const measureBase = async (view, width) => {
      const info = await page.evaluate(() => {
        const active = document.querySelector('.view:not([hidden])')
        return {
          active: active ? active.getAttribute('data-view') : '',
          doc: document.documentElement.scrollWidth,
          iw: innerWidth
        }
      })
      const where = view + '@' + width
      need(where, info.active === view, '当前视图不是 ' + view + '（' + info.active + '）')
      need(where, info.doc <= info.iw + 1, '页面横向滚动 doc=' + info.doc + ' iw=' + info.iw)
    }

    const checkSites = async (where) => {
      const r = await page.evaluate(() => {
        const items = [...document.querySelectorAll('[data-view="sites"] .site-item')]
        const first = items[0]
        const name = first && first.querySelector('.si-txt b')
        const list = document.querySelector('[data-view="sites"] .sites-rows')
        const box = e => e ? { right: Math.round(e.getBoundingClientRect().right), w: Math.round(e.getBoundingClientRect().width) } : null
        return { items: items.length, list: box(list), first: box(first), name: name ? { right: Math.round(name.getBoundingClientRect().right), cw: name.clientWidth, sw: name.scrollWidth } : null }
      })
      need(where, r.items > 0, '站点列表没有行')
      need(where, r.first && r.first.right <= (await page.evaluate(() => innerWidth)) + 1, '站点行超出视口')
      need(where, r.name && r.name.sw <= r.name.cw + 1, '站点名被横向裁切')
    }

    const checkSources = async (where) => {
      const r = await page.evaluate(() => {
        const body = document.querySelector('[data-view="sources"] #dl-body')
        const ops = document.querySelector('[data-view="sources"] .dl-ops')
        const bar = document.querySelector('[data-view="sources"] .dl-bar')
        const box = e => e ? { right: Math.round(e.getBoundingClientRect().right), cw: e.clientWidth, sw: e.scrollWidth } : null
        return { body: box(body), ops: box(ops), bar: box(bar), iw: innerWidth }
      })
      need(where, r.body && r.body.sw <= r.body.cw + 1, '数据清单横向溢出')
      need(where, r.ops && r.ops.right <= r.iw + 1, '送审/归档操作区超出视口')
      need(where, r.bar && r.bar.right <= r.iw + 1, '筛选栏超出视口')
    }

    const clickQueueTab = async (label) => {
      await page.evaluate(l => {
        const b = [...document.querySelectorAll('[data-view="queue"] .seg-tabs button')].find(x => x.textContent.trim() === l)
        if (b) b.click()
      }, label)
      await page.waitForTimeout(500)
    }

    const checkQueue = async (where, empty) => {
      const r = await page.evaluate(() => {
        const list = document.querySelector('[data-view="queue"] .queue-list')
        const detail = document.querySelector('[data-view="queue"] .queue-detail')
        const item = document.querySelector('[data-view="queue"] .q-item')
        const title = document.querySelector('[data-view="queue"] .qd-title-row h2')
        const grid = document.querySelector('[data-view="queue"] .qd-grid')
        const box = e => e ? { x: Math.round(e.getBoundingClientRect().x), right: Math.round(e.getBoundingClientRect().right), w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) } : null
        return { list: box(list), detail: box(detail), item: box(item), title: box(title), grid: box(grid), iw: innerWidth }
      })
      need(where, r.list && r.list.right <= r.iw + 1, '队列列表超出视口')
      need(where, r.detail && r.detail.right <= r.iw + 1, '队列详情超出视口')
      if (r.iw <= 900) {
        need(where, r.list && r.detail && r.list.x === r.detail.x && Math.abs(r.list.w - r.detail.w) <= 1, '小屏队列列表/详情不同宽')
      }
      if (!empty) {
        need(where, r.item, '队列没有条目')
        need(where, r.title && r.title.h <= 32, '待审核标题被挤成多行')
        need(where, r.grid && r.grid.right <= r.iw + 1, '待审核卡片超出视口')
      }
    }

    const checkLogs = async (where) => {
      const r = await page.evaluate(() => {
        const bar = document.querySelector('[data-view="logs"] .log-bar')
        const buttons = [...document.querySelectorAll('[data-view="logs"] .log-bar button')]
        const panel = document.querySelector('[data-view="logs"] .log-panel')
        const box = e => e ? { right: Math.round(e.getBoundingClientRect().right), cw: e.clientWidth, sw: e.scrollWidth } : null
        return { bar: box(bar), panel: box(panel), buttons: buttons.map(b => ({ t: b.textContent.trim(), right: Math.round(b.getBoundingClientRect().right), cw: b.clientWidth, sw: b.scrollWidth })), iw: innerWidth }
      })
      need(where, r.bar && r.bar.right <= r.iw + 1, '日志工具条超出视口')
      need(where, r.panel && r.panel.right <= r.iw + 1, '日志面板超出视口')
      r.buttons.forEach(b => need(where, b.sw <= b.cw + 1, '日志按钮文字溢出：' + b.t))
    }

    const checkSettings = async (where) => {
      const r = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('[data-view="settings"] .set-card-head > button')]
        return { iw: innerWidth, buttons: btns.map(b => ({ t: b.textContent.trim(), right: Math.round(b.getBoundingClientRect().right), cw: b.clientWidth, sw: b.scrollWidth })) }
      })
      r.buttons.forEach(b => {
        need(where, b.right <= r.iw + 1, '设置按钮超出视口：' + b.t)
        need(where, b.sw <= b.cw + 1, '设置按钮文字溢出：' + b.t)
      })
    }

    const checkChangelog = async (where) => {
      const r = await page.evaluate(() => {
        const body = document.querySelector('[data-view="changelog"] .changelog-body')
        return { body: body ? { right: Math.round(body.getBoundingClientRect().right), cw: body.clientWidth, sw: body.scrollWidth } : null, iw: innerWidth }
      })
      need(where, r.body && r.body.sw <= r.body.cw + 1, '更新日志横向溢出')
      need(where, r.body && r.body.right <= r.iw + 1, '更新日志超出视口')
    }

    const checkCrawl = async (where) => {
      const before = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('[data-view="crawl"] .node-row')]
        const badges = [...document.querySelectorAll('[data-view="crawl"] .todo-badge')]
        const box = e => e ? { top: Math.round(e.getBoundingClientRect().top), bottom: Math.round(e.getBoundingClientRect().bottom), right: Math.round(e.getBoundingClientRect().right) } : null
        return { rows: rows.map(box), badges: badges.map(b => { const p = b.parentElement; return { badge: box(b), parent: box(p), display: p ? getComputedStyle(p).display : '' } }), iw: innerWidth }
      })
      need(where, before.rows.length > 0, '下载器行没有渲染')
      before.rows.forEach(r => need(where, r.right <= before.iw + 1, '下载器行超出视口'))
      before.badges.forEach(b => need(where, b.badge && b.parent && b.badge.top >= b.parent.top - 1 && b.badge.bottom <= b.parent.bottom + 1, '未接徽标掉到标签下一行'))
      await page.locator('#tp-change').click()
      await page.waitForTimeout(400)
      const modal = await page.evaluate(() => {
        const items = [...document.querySelectorAll('#crawl-target-modal .target-item')]
        return { items: items.length, iw: innerWidth, rights: items.map(x => Math.round(x.getBoundingClientRect().right)) }
      })
      need(where, modal.items > 0, '目标站弹窗没有目标站')
      modal.rights.forEach(r => need(where, r <= modal.iw + 1, '目标站行超出视口'))
      await page.evaluate(() => { const b = document.querySelector('#crawl-target-modal .modal-head button'); if (b) b.click() })
      await page.waitForTimeout(200)
    }

    const checkDashboard = async (where) => {
      const r = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('[data-view="dashboard"] .stat-card')]
        const iw = innerWidth
        return { n: cards.length, right: cards.map(c => Math.round(c.getBoundingClientRect().right)), iw }
      })
      need(where, r.n > 0, '总览统计卡没有渲染')
      r.right.forEach(x => need(where, x <= r.iw + 1, '总览统计卡超出视口'))
    }

    const pages = ['dashboard', 'sites', 'crawl', 'queue', 'sources', 'logs', 'settings', 'changelog']
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      await page.waitForTimeout(300)
      for (const view of pages) {
        await goto(view)
        const where = view + '@' + width
        await measureBase(view, width)
        if (view === 'dashboard') await checkDashboard(where)
        if (view === 'sites') await checkSites(where)
        if (view === 'sources') await checkSources(where)
        if (view === 'logs') await checkLogs(where)
        if (view === 'settings') await checkSettings(where)
        if (view === 'changelog') await checkChangelog(where)
        if (view === 'crawl') await checkCrawl(where)
        if (view === 'queue') {
          await clickQueueTab('已通过')
          await checkQueue(where + '-empty', true)
          await clickQueueTab('全部')
          await checkQueue(where + '-full', false)
        }
        ok(where, '布局检查完成')
      }
    }

    if (pageErrors.length) fail('browser', 'JS 报错：' + pageErrors.slice(0, 2).join(' | '))
  } catch (e) {
    fail('run', e && e.message ? e.message : String(e))
    if (out) console.error(out.split('\n').slice(-8).join('\n'))
  } finally {
    if (browser) await browser.close().catch(() => {})
    child.kill()
    fs.rmSync(TMP_ROOT, { recursive: true, force: true })
  }

  console.log('响应式布局 · ' + WIDTHS.length + ' 宽度 × 8 页')
  passes.forEach(x => console.log('PASS  ' + x))
  if (failures.length) {
    failures.forEach(x => console.error('FAIL  ' + x))
    console.error(failures.length + ' 项失败')
    process.exit(1)
  }
  console.log(passes.length + ' 项通过')
}

run().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(2) })
