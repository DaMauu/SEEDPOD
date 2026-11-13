<template>
<div class="drawers">
<div id="crawl-panel">
  <section class="drawer open crawl-dry">
    <div class="drawer-head">
      <div class="drawer-t">
        <div class="drawer-title">本地演练（不发请求）</div>
        <div class="drawer-desc">按设置跑一遍抓取 → 查重 → 发布的步骤，只走本地步骤，不发真实请求。</div>
      </div>
      <div class="drawer-head-right">
        <span class="drawer-meta" id="crawl-dry-meta">未运行</span>
        <select class="input slim" id="crawl-site" title="从哪个站抓"><option value="">选来源站</option></select>
        <select class="input slim" id="crawl-limit" title="这一轮抓多少条词条（是条数，不是页数）">
          <option value="5">5 条（试）</option>
          <option value="10">10 条</option>
          <option value="50">50 条</option>
          <option value="100">100 条</option>
          <option value="200">200 条</option>
        </select>
        <button class="btn ghost slim" id="crawl-plan-btn" title="只读本地配置，不发请求">看地址</button>
        <button class="btn slim" id="crawl-live-run">抓一页</button>
        <button class="btn primary slim" id="crawl-dry-run">开始演练</button>
      </div>
    </div>
    <div class="drawer-body" id="crawl-dry-body" hidden><div class="dl-dry" id="crawl-dry-box"></div></div>
  </section>
</div>
        <section class="drawer open" data-i="nodes" data-name="下载器">
          <div class="drawer-head">
            <div class="drawer-t">
              <div class="drawer-title">下载器</div>
            </div>
            <div class="drawer-head-right">
              <span class="drawer-meta" id="nodes-drawer-meta"></span>
              <button type="button" class="btn primary slim" id="node-add">新增下载器</button>
            </div>
          </div>
          <div class="drawer-body drawer-body-flush">
            <div class="nodes-inner">
      <div class="nodes-sum" id="nodes-sum"></div>
      <div class="nodes-grid" id="nodes-grid"></div>


            </div>
          </div>
        </section>

      </div>
</template>
