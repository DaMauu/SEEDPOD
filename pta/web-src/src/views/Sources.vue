<template>
<div class="dl-wrap">
        <div class="dl-bar">
          <input class="input" id="dl-q" placeholder="搜标题 / 分辨率" style="width:220px">
          <select class="select slim" id="dl-site"><option value="">全部站点</option></select>
          <select class="select slim" id="dl-type"><option value="">全部类型</option></select>
          <select class="select slim" id="dl-status">
            <option value="">全部状态</option>
            <option value="new">待筛选</option>
            <option value="selected">已送审</option>
            <option value="published">已发布</option>
            <option value="skipped">跳过</option>
            <option value="archived">归档</option>
          </select>
          <select class="select slim" id="dl-mark" title="禁转 / 独占 / DIY / 限转 按标题关键词判；未满 7 天按站上发布时间判；都只打标不过滤，点行内标签可手动开关">
            <option value="">全部标记</option>
            <option value="any">有任意标记</option>
            <option value="noRedistribute">禁转</option>
            <option value="exclusive">独占</option>
            <option value="diy">DIY</option>
            <option value="limited">限转</option>
            <option value="limitedDays">未满 7 天</option>
            <option value="existing">已有（重复）</option>
          </select>
          <select class="select slim" id="dl-target" title="向这个目标站查：站里是不是已经有这张原盘">
            <option value="">选目标站</option>
          </select>
          <div class="spacer"></div>
          <button class="btn slim" id="dl-dupe" title="用词条标题去目标站搜一次，判定 可发／仅DIY可发／已有原盘">向目标站查重</button>
          <button class="btn slim" id="dl-check">查重</button>
          <button class="btn slim" id="dl-screen">按条件送审</button>
          <button class="btn ghost slim" id="dl-archive">归档已跳过/已有</button>
          <button class="btn ghost slim" id="dl-export">导出 JSON</button>
        </div>
        <div class="dl-panel">
          <div class="dl-head">
            <span>标题</span><span>类型</span><span>分辨率</span><span>大小</span><span>入库</span><span>状态</span><span class="ta-r">操作</span>
          </div>
          <div id="dl-body"></div>
          <div class="dl-foot"><span>共 <b id="dl-count">0</b> 条</span><div class="spacer"></div>
            <button class="link-btn" id="dl-prev">上一页</button>
            <span class="soft" id="dl-page">第 1 页</span>
            <button class="link-btn" id="dl-next">下一页</button>
          </div>
        </div>
      </div>
</template>
