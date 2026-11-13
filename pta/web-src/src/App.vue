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
<div class="modal-mask" id="site-modal" hidden>
  <div class="modal">
    <div class="modal-head"><h2>添加站点</h2><button class="btn ghost slim" id="site-modal-x">关闭</button></div>
    <label class="field"><span>站点地址</span>
      <input class="input" id="ns-url" placeholder="https://example.com/index.php" autocomplete="off"></label>
    <label class="field"><span>架构</span>
      <select class="select" id="ns-arch">
        <option value="auto">自动判断</option>
        <option value="NP">NexusPHP</option>
        <option value="UNIT3D">UNIT3D</option>
        <option value="GZ">Gazelle</option>
        <option value="OTHER">其它</option>
        <option value="?">未确认</option>
      </select></label>
    <label class="field"><span>备注（可选）</span>
      <input class="input" id="ns-note" placeholder="比如：需要邀请、只收原盘"></label>
    <div class="modal-foot">
      <button class="btn ghost slim" id="site-modal-cancel">取消</button>
      <button class="btn primary slim" id="site-modal-ok">添加</button>
    </div>
  </div>
</div>

<div class="modal-mask" id="bulk-modal" hidden>
  <div class="modal wide">
    <div class="modal-head"><h2>批量设置</h2><button class="btn ghost slim" id="bulk-x">关闭</button></div>
    <p class="modal-sub">只改你选过的项，其余保持原样；应用到已选的 <b id="bulk-count">0</b> 个站点。</p>
    <div class="modal-scroll">
      <div class="sd-field"><span>覆盖全局抓取</span><select class="select" id="bm-ovr">
        <option value="keep">不改</option><option value="on">开启</option><option value="off">关闭</option></select></div>
      <div class="sd-field"><span>抓取间隔</span><select class="select" id="bm-iv">
        <option value="keep">不改</option><option>跟随全局</option><option>1 分钟</option><option>5 分钟</option><option>15 分钟</option><option>1 小时</option></select></div>
      <div class="sd-field"><span>单站每日上限</span><input class="input" id="bm-daily" placeholder="留空＝不改"></div>
      <div class="sd-field"><span>抓详情页</span><select class="select" id="bm-det">
        <option value="keep">不改</option><option value="on">开启</option><option value="off">关闭</option></select></div>
      <div class="sd-field"><span>站点优先级</span><select class="select" id="bm-prio">
        <option value="keep">不改</option><option value="high">高（先抓）</option><option value="normal">普通</option><option value="low">低（最后抓）</option></select></div>
    </div>
    <div class="modal-foot">
      <button class="btn ghost slim" id="bulk-cancel">取消</button>
      <button class="btn primary slim" id="bulk-ok">应用到所选</button>
    </div>
  </div>
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

<div class="modal-mask" id="target-modal" hidden>
  <div class="modal wide">
    <div class="modal-head"><h2>选择主站</h2><button class="btn ghost slim" id="target-x">关闭</button></div>
    <p class="modal-sub">发布前会先查这个站有没有同样的资源。</p>
    <input class="input" id="target-q" placeholder="搜索站点名 / 域名" autocomplete="off">
    <div class="target-list" id="target-list"></div>
  </div>
</div>

<div class="modal-mask" id="node-modal" hidden>
  <div class="modal">
    <div class="modal-head"><h2 id="node-modal-title">下载器设置</h2></div>
    <label class="field"><span>名称</span><input class="input" id="nd-name" placeholder="留空就用地址"></label>
    <label class="field"><span>地址</span><input class="input" id="nd-host" placeholder="http://主机:端口，qB 的 Web 地址就是它的 API 地址"></label>
    <div class="modal-two">
      <label class="field"><span>qB 用户名</span><input class="input" id="nd-user" placeholder="admin"></label>
      <label class="field"><span>qB 密码</span><input class="input" type="password" id="nd-pass" placeholder="留空表示不设置" autocomplete="new-password"></label>
    </div>
    <div class="modal-two">
      <label class="field"><span>同时下载</span><input class="input" id="nd-down" value="3"></label>
      <label class="field"><span>做种上限</span><input class="input" id="nd-seed" value="500"></label>
    </div>
    <div class="modal-two">
      <label class="field"><span>下载限速</span><input class="input" id="nd-dllimit" value="不限" placeholder="如 50 MB/s"></label>
      <label class="field"><span>上传限速</span><input class="input" id="nd-ullimit" value="不限" placeholder="如 20 MB/s"></label>
    </div>
    <div class="modal-two">
      <label class="field"><span>分享率达标删种</span><input class="input" id="nd-ratio" value="2.0"></label>
      <label class="field"><span>保种天数</span><input class="input" id="nd-days" value="30"></label>
    </div>
    <div class="modal-two">
      <label class="field"><span>下载路径</span><input class="input" id="nd-path" value="/data/pt"></label>
      <label class="field"><span>磁盘低水位</span><input class="input" id="nd-lowdisk" value="50 GB"></label>
    </div>
    <div class="nd-cats">
      <div class="nd-cats-head">
        <span>分类</span>
        <span class="nd-cats-status" id="nd-cat-status">未拉取</span>
        <div class="spacer"></div>
        <button class="btn ghost slim" id="nd-fetch">拉取分类</button>
      </div>
      <div class="nd-cats-list" id="nd-cat-list"></div>
      <p class="nd-cats-hint">从这台 qB 里读出来的分类，新任务默认用选中的那个。</p>
    </div>
    <div class="nd-probe">
      <button class="btn ghost slim" id="nd-test">测试连接</button>
      <span class="nd-probe-res" id="nd-test-res">只连你自己填的地址，8 秒超时</span>
    </div>
    <div class="modal-foot">
      <button class="btn ghost slim danger" id="node-del">删除</button>
      <div class="spacer"></div>
      <button class="btn ghost slim" id="node-cancel">关闭</button>
      <button class="btn primary slim" id="node-ok">保存</button>
    </div>
  </div>
</div>

<div class="modal-mask" id="rule-modal" hidden>
  <div class="modal">
    <div class="modal-head"><h2 id="rule-title">规则</h2></div>
    <div class="modal-scroll" id="rule-body"></div>
    <div class="modal-foot">
      <button class="btn ghost slim" id="rule-close">关闭</button>
      <button class="btn primary slim" id="rule-ok">保存</button>
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
