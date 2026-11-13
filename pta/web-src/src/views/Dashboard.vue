<template>
<div class="bento-top">
        <div class="card stat-card">
          <div class="panel-head"><h2>统计</h2><span class="zone-sub">今日 / 本月 / 累计</span></div>
          <div class="stat-grid">
            <div class="stat-hero">
              <span>今日已发</span>
              <b id="hero-num">3</b>
              <i id="hero-delta">较昨日 +1</i>
            </div>
            <div class="stat-list">
              <div class="hstat"><span>本月已发</span><b id="stat-month">84</b><i>目标 120</i></div>
              <div class="hstat"><span>总发布数</span><b id="stat-total">1,240</b><i>历史累计</i></div>
              <div class="hstat"><span>抓取总数</span><b id="stat-db">128,406</b><i>今日 +87</i></div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="panel-head"><h2>实时日志</h2><span class="live"><i></i>实时</span><a href="#logs">全部</a></div>
          <div class="list" id="dash-logs"></div>
        </div>
      </div>

      <div class="bento-bottom">
        <div class="card status-card">
          <div class="panel-head"><h2>系统状态</h2><a href="#crawl">详情</a></div>
          <div class="health-row" id="health-strip"></div>
        </div>
        <div class="card">
          <div class="panel-head"><h2>最近发布</h2><a href="#queue">队列</a></div>
          <div class="list" id="dash-published"></div>
        </div>
        <div class="card">
          <div class="panel-head"><h2>待审核</h2><a href="#queue" id="dash-pending-all">全部</a></div>
          <div class="list" id="dash-pending"></div>
        </div>
      </div>
</template>
