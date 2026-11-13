<template>
<div class="log-wrap">
        <div class="log-bar">
          <div class="seg-tabs" id="log-tabs">
            <button type="button" data-lvl="all" class="active">全部</button>
            <button type="button" data-lvl="info">INFO</button>
            <button type="button" data-lvl="warn">WARN</button>
            <button type="button" data-lvl="error">ERROR</button>
          </div>
          <div class="spacer"></div>
          <button class="btn ghost slim" id="log-dl">下载 log</button>
          <button class="btn ghost slim" id="log-clear">清屏</button>
        </div>
        <div class="log-panel" id="log-lines"></div>
      </div>
</template>
