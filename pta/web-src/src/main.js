import * as Vue from 'vue'
import { createApp } from 'vue'
import App from './App.vue'
import './data/rules.js'

window.Vue = Vue
createApp(App).mount('#app')
