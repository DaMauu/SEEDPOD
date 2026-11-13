<template>
<div class="sites-wrap">
        <div class="sites-bar">
          <label class="sites-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
            <input id="site-q" placeholder="搜索站点 / 域名">
          </label>
          <div class="seg-tabs" id="site-status">
            <button type="button" data-status="all" class="active">全部<i>0</i></button>
            <button type="button" data-status="on">启用<i>0</i></button>
            <button type="button" data-status="off">停用<i>0</i></button>
          </div>
          <div class="spacer"></div>
          <select class="select slim" id="site-arch">
            <option value="all">全部架构</option>
            <option value="NP">NexusPHP</option>
            <option value="UNIT3D">UNIT3D</option>
            <option value="GZ">Gazelle</option>
            <option value="OTHER">其它</option>
            <option value="?">未确认</option>
          </select>
          <select class="select slim" id="site-login">
            <option value="all">全部状态</option>
            <option value="ok">可用</option>
            <option value="fail">失效</option>
            <option value="none">未自检</option>
          </select>
          <select class="select slim" id="site-preset">
            <option value="all">全部预设</option>
            <option value="pending">预设待确认</option>
            <option value="confirmed">预设已确认</option>
            <option value="nocats">没有分类 id</option>
          </select>
          <select class="select slim" id="site-crawl">
            <option value="all">全部抓取</option>
            <option value="crawled">抓过的</option>
            <option value="today">今日抓过</option>
            <option value="never">还没抓过</option>
          </select>
          <button class="btn ghost slim" id="bulk-open" disabled>批量设置</button>
          <button class="btn ghost slim" id="site-selfcheck" title="对有 cookie 的站点逐个跑一次会话自检；只发一次 GET，不抓列表">自检有 cookie 的站</button>
          <button class="btn primary slim" data-act="new-site">添加站点</button>
        </div>

        <div class="sites-stats" id="sites-stats"></div>

        <div class="sites-panel">

          <div class="st-head">
            <span class="st-all"><input type="checkbox" id="site-all" aria-label="全选本站点"></span><span></span><span>站点</span><span>架构</span><span>登录</span><span>预设</span><span>抓取</span><span>上次抓取</span>
          </div>
          <div class="sites-rows" id="sites-list"></div>
          <div class="sites-pager" id="sites-pager"></div>
        </div>
        <div class="site-expand" id="site-detail" hidden></div>
      </div>
</template>
