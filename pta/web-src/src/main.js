import * as Vue from 'vue'
import { createApp } from 'vue'
import App from './App.vue'
import './styles/index.css'
import './data/rules.js'
import { loadRuntimePresets } from './utils/presets-runtime'

window.Vue = Vue
/* 任何接口 401 都通知 App 弹登录，页面轮询不会在过期会话上无限转 */
const rawFetch = window.fetch.bind(window)
window.fetch = function () {
  return rawFetch.apply(null, arguments).then(function (r) {
    if (r && r.status === 401) window.dispatchEvent(new Event('pta-unauthorized'))
    return r
  })
}
/* 先拉运行时全局预设（未登录时回退到打包默认值），再挂载页面 */
loadRuntimePresets().finally(function () { createApp(App).mount('#app') })
