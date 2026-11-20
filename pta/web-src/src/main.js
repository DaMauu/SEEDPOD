import * as Vue from 'vue'
import { createApp } from 'vue'
import App from './App.vue'
import './styles/index.css'
import './data/rules.js'

window.Vue = Vue
/* 任何接口 401 都通知 App 弹登录，页面轮询不会在过期会话上无限转 */
const rawFetch = window.fetch.bind(window)
window.fetch = function () {
  return rawFetch.apply(null, arguments).then(function (r) {
    if (r && r.status === 401) window.dispatchEvent(new Event('pta-unauthorized'))
    return r
  })
}
createApp(App).mount('#app')
