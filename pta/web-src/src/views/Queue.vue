<template>
<div class="queue-bar">
        <div class="seg-tabs" id="queue-tabs">
          <button type="button" data-qtab="all" class="active">全部</button>
          <button type="button" data-qtab="pending">待确认</button>
          <button type="button" data-qtab="approved">已通过</button>
          <button type="button" data-qtab="failed">失败</button>
        </div>
        <input class="input slim" id="queue-q" placeholder="搜标题 / 中文名" style="width:220px">
        <div class="spacer"></div>
        <span class="t-sub" id="queue-count"></span>
        <button class="btn ghost slim" id="q-bulkcheck">批量查重</button>
        <button class="btn ghost slim" id="q-bulkapprove">全部批准</button>
        <button class="btn ghost slim" id="q-bulkpublish">全部发布</button>
      </div>

      <div class="queue-split">
        <aside class="queue-list">
          <div class="queue-items" id="queue-items"></div>
          <div class="queue-page">
            <button class="btn ghost slim" type="button" id="queue-prev" disabled>上一页</button>
            <span class="t-sub" id="queue-page-info">第 1 / 1 页</span>
            <button class="btn ghost slim" type="button" id="queue-next" disabled>下一页</button>
          </div>
        </aside>
        <div class="queue-detail" id="queue-detail"></div>
      </div>
</template>
