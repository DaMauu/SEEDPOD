import * as Vue from 'vue'
import { createApp } from 'vue'
import App from './App.vue'
import './legacy/data.js'
import './legacy/sites-data.js'

window.Vue = Vue
createApp(App).mount('#app')
import('./legacy/app.js')
