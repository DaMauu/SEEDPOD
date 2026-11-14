<template>
  <div class="layout">
    <main class="main">
<div class="topbar">
      <a class="brand" href="#dashboard" title="回总览">
        <img class="top-logo" src="/assets/whale.png" alt="">
        <span class="brand-name">SEEDPOD</span>
        <span class="brand-sub">原盘转载面板</span>
      </a>
      <div class="topbar-right">
        <div class="pills-row" id="status-pills">
          <span class="pill" id="pill-service"><span class="dot"></span>未连接后端</span>
          <span class="pill" id="pill-pending" hidden><span class="dot warn"></span>0 条待审核</span>
          <span class="pill" id="pill-nodes"><span class="dot ok"></span>下载器 0</span>
        </div>
        <div class="pills-row" id="page-pills"></div>
      </div>
    </div>
    <section class="view" data-view="dashboard"><Dashboard /></section>
    <section class="view" data-view="sites" hidden><Sites /></section>
    <section class="view" data-view="crawl" hidden><Crawl /></section>
    <section class="view" data-view="queue" hidden><Queue /></section>
    <section class="view" data-view="sources" hidden><Sources /></section>
    <section class="view" data-view="logs" hidden><Logs /></section>
    <section class="view" data-view="changelog" hidden><Changelog /></section>
    <section class="view" data-view="settings" hidden><Settings /></section>
<footer class="dev-foot" id="dev-foot">
      <span>加载中…</span>
    </footer>
    </main>
  </div>
<div class="modal-mask" id="confirm-modal" hidden>
  <div class="modal" style="width:390px">
    <div class="modal-head"><h2 id="confirm-title">确认操作</h2></div>
    <p class="modal-sub" id="confirm-text"></p>
    <div class="modal-foot">
      <button class="btn ghost slim" id="confirm-no">取消</button>
      <button class="btn primary slim" id="confirm-yes">确认</button>
    </div>
  </div>
</div>

  <div id="dock-root"></div>
</template>

<script setup>
import Dashboard from './views/Dashboard.vue'
import Sites from './views/Sites.vue'
import Crawl from './views/Crawl.vue'
import Queue from './views/Queue.vue'
import Sources from './views/Sources.vue'
import Logs from './views/Logs.vue'
import Changelog from './views/Changelog.vue'
import Settings from './views/Settings.vue'
</script>
