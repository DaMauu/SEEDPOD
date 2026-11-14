<template>
  <div class="sites-wrap">
    <div class="sites-bar">
      <label class="sites-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        <input id="site-q" v-model="q" placeholder="搜索站点 / 域名">
      </label>
      <div class="seg-tabs" id="site-status">
        <button v-for="t in statusTabs" :key="t.v" type="button" :class="{ active: statusFilter === t.v }" @click="statusFilter = t.v">
          {{ t.label }}<i>{{ t.n }}</i>
        </button>
      </div>
      <div class="spacer"></div>
      <select v-model="archFilter" class="select slim" id="site-arch">
        <option value="all">全部架构</option>
        <option value="NP">NexusPHP</option>
        <option value="UNIT3D">UNIT3D</option>
        <option value="GZ">Gazelle</option>
        <option value="OTHER">其它</option>
        <option value="?">未确认</option>
      </select>
      <select v-model="loginFilter" class="select slim" id="site-login">
        <option value="all">全部状态</option>
        <option value="ok">可用</option>
        <option value="fail">失效</option>
        <option value="none">未自检</option>
      </select>
      <select v-model="presetFilter" class="select slim" id="site-preset">
        <option value="all">全部预设</option>
        <option value="pending">预设待确认</option>
        <option value="confirmed">预设已确认</option>
        <option value="nocats">没有分类 id</option>
      </select>
      <select v-model="crawlFilter" class="select slim" id="site-crawl">
        <option value="all">全部抓取</option>
        <option value="crawled">抓过的</option>
        <option value="today">今日抓过</option>
        <option value="never">还没抓过</option>
      </select>
      <button class="btn ghost slim" id="bulk-open" :disabled="!picks.length" @click="openBulk">
        {{ picks.length ? '批量设置（' + picks.length + '）' : '批量设置' }}
      </button>
      <button class="btn ghost slim" id="site-selfcheck" :disabled="busy.selfcheck || !cookieCount" @click="selfcheckAll" title="对有 cookie 的站点逐个跑一次会话自检；每个站只发一次 GET">
        {{ busy.selfcheck ? '自检中…' : '自检有 cookie 的站' }}
      </button>
      <button class="btn primary slim" type="button" @click="openAdd">添加站点</button>
    </div>

    <div class="sites-stats" id="sites-stats">
      <div class="ss-nums">
        <div><span>总站点</span><b>{{ stats.total }}</b></div>
        <div><span>启用</span><b>{{ stats.enabled }}</b></div>
        <div><span>登录失效</span><b class="warn">{{ stats.loginFail }}</b></div>
        <div><span>还没自检</span><b>{{ stats.unknown }}</b></div>
      </div>
      <div class="ss-arch">
        <div class="ss-bar">
          <i v-for="(x, i) in stats.segs" :key="i" class="seg" :style="{ width: x.w + '%', background: x.color }"></i>
        </div>
        <div class="ss-legend">
          <span v-for="x in stats.legend" :key="x.name"><i class="dot" :style="{ background: x.color }"></i>{{ x.name }} {{ x.count }}</span>
        </div>
      </div>
      <div class="ss-cov">{{ stats.cov }}</div>
    </div>

    <div class="sites-panel">
      <div class="st-head">
        <span class="st-all"><input type="checkbox" id="site-all" aria-label="全选本站点" :checked="allPicked" :indeterminate.prop="somePicked" @change="toggleAll"></span>
        <span></span><span>站点</span><span>架构</span><span>登录</span><span>预设</span><span>抓取</span><span>上次抓取</span>
      </div>
      <div class="sites-rows" id="sites-list">
        <template v-for="s in pageRows" :key="s.name">
          <div class="site-item" :class="{ on: sel === s.name }" @click="openSite(s.name)">
            <input type="checkbox" class="site-pick" :checked="picks.includes(s.name)" @click.stop @change="togglePick(s.name)">
            <span class="st" :class="dotCls(s)"><i></i></span>
            <span class="si-txt"><b>{{ s.title }}</b></span>
            <span class="si-arch"><em class="chip" :class="archCls(s)">{{ archLabel(s) }}</em></span>
            <span class="si-login" :class="dotCls(s)">{{ loginTxt(s) }}</span>
            <span class="si-preset" :class="{ on: !!s.preset }">{{ presetTxt(s) }}</span>
            <span class="si-mode">{{ modeTxt(s) }}</span>
            <span class="si-last">{{ lastCrawlTxt(s) }}</span>
          </div>

          <div v-if="sel === s.name" class="site-expand" id="site-detail">
            <div class="sd-top">
              <em class="ava lg" :class="archCls(s)">{{ initials(s) }}</em>
              <div class="sd-id">
                <div class="sd-title-row">
                  <h2>{{ s.title }}</h2>
                  <span class="pill2" :class="s.enabled ? 'on' : 'off'">{{ s.enabled ? '启用中' : '已停用' }}</span>
                  <span class="chip" :class="s.preset ? 'np' : 'unk'">搜索预设 {{ s.preset ? (s.preset.confirmed ? '已确认' : '待确认') : '未确认' }}</span>
                </div>
                <span class="sd-url">{{ s.url }} · {{ s.name }}</span>
                <span class="sd-selfcheck" id="sd-selfcheck">{{ s.loginAt ? '上次自检 ' + fmtWhen(s.loginAt) + ' · ' + loginTxt(s) : '还没做过连接自检' }}</span>
              </div>
              <div class="sd-actions">
                <button class="switch sm" :class="{ on: s.enabled }" type="button" title="启用或停用这个站的抓取" @click.stop="toggleEnabled(s)"><i></i></button>
                <button class="btn slim" type="button" :disabled="busy.crawl || !s.enabled" title="按搜索预设抓这个站一页；真抓取受服务端开关约束" @click.stop="crawlOne(s)">抓一页</button>
                <select class="select slim sd-arch-sel" id="sd-arch" :value="s.arch" title="站点架构" @click.stop @change="setArch(s, $event)">
                  <option v-for="a in archOptions" :key="a.v" :value="a.v">{{ a.label }}</option>
                </select>
                <button class="btn slim" type="button" :disabled="busy.selfcheck || !s.cookieSaved" title="用已保存的 cookie 做一次会话自检；只发一次 GET" @click.stop="selfcheckOne(s)">连接自检</button>
                <button class="btn slim tabbtn" :class="{ active: tab === 'overview' }" type="button" @click.stop="tab = 'overview'">概览</button>
                <button class="btn slim tabbtn" :class="{ active: tab === 'settings' }" type="button" @click.stop="tab = 'settings'">设置</button>
              </div>
              <button class="sheet-x" type="button" aria-label="关闭" @click.stop="closeSheet">✕</button>
            </div>

            <div v-if="tab === 'settings'" class="sd-tabs">
              <button v-for="t in setTabs" :key="t.v" class="btn slim tabbtn" :class="{ active: setTab === t.v }" type="button" @click.stop="setTab = t.v">{{ t.label }}</button>
            </div>

            <div class="sd-scroll">
              <div v-if="tab === 'overview'" class="sd-ov">
                <div class="sd-strip">
                  <span>已收录<b>{{ detail.catalog ? detail.catalog.total : '—' }}</b></span>
                  <span>今日<b>{{ s.todayCount ? '+' + s.todayCount : '—' }}</b></span>
                  <span>上次<b>{{ s.lastAt ? fmtWhen(s.lastAt) : '未抓取' }}</b></span>
                  <span>下次<b>{{ s.enabled ? '手动触发（点「抓一页」）' : '已停用' }}</b></span>
                </div>
                <div class="sd-compact">
                  <div class="sd-col">
                    <div class="sd-block">
                      <h4>登录</h4>
                      <div class="sd-row"><span>状态</span><b :class="dotCls(s) + '-t'">{{ loginTxt(s) }}</b></div>
                      <div class="sd-row"><span>方式</span><b>Cookie</b></div>
                      <div class="sd-row"><span>登录凭据</span><b>{{ s.cookieSaved ? '已保存' : '未保存' }}</b></div>
                      <div class="sd-row"><span>引擎</span><b>{{ engineTxt(s) }}</b></div>
                      <div class="sd-row"><span>采样</span><b>{{ sampleTxt(s) }}</b></div>
                      <div class="sd-row"><span>来源</span><b>{{ kindTxt(s) }}</b></div>
                    </div>
                    <div class="sd-block">
                      <h4>抓取</h4>
                      <div class="sd-row"><span>上次结果</span><b :class="(s.lastAt ? 'ok' : 'idle') + '-t'">{{ s.lastAt ? '已抓取' : '未抓取' }}</b></div>
                      <div class="sd-row"><span>今日已跑</span><b>{{ s.todayCount }} 次</b></div>
                      <div class="sd-row"><span>方式</span><b>{{ modeTxt(s) }}</b></div>
                      <div class="sd-row"><span>范围</span><b>{{ catRangeTxt(s) }}</b></div>
                    </div>
                  </div>
                  <div class="sd-recent-wrap">
                    <h4>最近收录</h4>
                    <div v-if="!detail.items.length" class="sd-row"><span>状态</span><b>这个站还没有词条</b></div>
                    <div v-for="r in detail.items" :key="r.id" class="sd-recent">
                      <span class="t-main">{{ r.title }}</span>
                      <span class="soft">{{ r.size }}</span>
                      <span class="soft">{{ String(r.createdAt || '').slice(5, 16).replace('T', ' ') }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else class="sd-form">
                <template v-if="setTab === 'login'">
                  <div class="set-fields">
                    <div class="set-field">
                      <div class="lbl"><span>站点地址</span></div>
                      <div class="ctl"><input v-model="form.url" class="input" placeholder="https://站点域名/index.php"></div>
                    </div>
                  </div>
                  <div class="set-fields">
                    <div class="set-field">
                      <div class="lbl"><span>Cookie（{{ s.cookieSaved ? '已保存' + cookieWhen(s) : '未保存' }}）</span></div>
                      <div class="ctl">
                        <textarea v-model="form.cookie" class="input sd-note" rows="3" :placeholder="s.cookieSaved ? '已保存的 cookie 不回显；要换就整段粘贴覆盖再保存' : '粘贴 name1=value1; name2=value2'"></textarea>
                      </div>
                    </div>
                  </div>
                  <div class="sd-cookie-bar">
                    <button class="btn ghost slim" id="sd-cookie-test" type="button" :disabled="busy.selfcheck || !s.cookieSaved" @click.stop="selfcheckOne(s)">自检</button>
                    <span class="sd-cookie-res" id="sd-cookie-res">{{ s.loginAt ? '上次自检 ' + fmtWhen(s.loginAt) + ' · ' + loginTxt(s) : '还没自检' }}</span>
                  </div>
                </template>

                <template v-else-if="setTab === 'search'">
                  <div class="set-fields">
                    <div class="set-field"><div class="lbl"><span>引擎</span></div><div class="ctl"><span class="fixed-val ref">{{ engineTxt(s) }}</span></div></div>
                    <div class="set-field"><div class="lbl"><span>预设来源</span></div><div class="ctl"><span class="fixed-val ref">{{ sourceTxt(s) }}</span></div></div>
                    <div class="set-field"><div class="lbl"><span>分类参数</span></div><div class="ctl"><span class="fixed-val ref">{{ paramTxt(s) }}</span></div></div>
                    <div class="set-field"><div class="lbl"><span>抓取状态</span></div><div class="ctl"><span class="fixed-val ref">{{ crawlTxt(s) }}</span></div></div>
                    <div class="set-field"><div class="lbl"><span>词条</span></div><div class="ctl"><span class="fixed-val ref">{{ catalogTxt(s) }}</span></div></div>
                  </div>
                  <div class="set-fields">
                    <div class="sd-block">
                      <h4>分类 id</h4>
                      <template v-if="catGroups.length">
                        <div v-for="g in catGroups" :key="g.name" class="sd-row"><span>{{ g.name }}</span><b>{{ g.ids }}</b></div>
                      </template>
                      <div v-else class="sd-row"><span>状态</span><b>还没有分类映射</b></div>
                    </div>
                  </div>
                  <div v-if="previewUrls.length" class="set-fields">
                    <div class="sd-block">
                      <h4>搜索链接预览</h4>
                      <a v-for="u in previewUrls" :key="u.url" class="sd-preset-url" :href="u.url" target="_blank" rel="noopener noreferrer">{{ u.tag }} → {{ u.short }}</a>
                      <div class="sd-row"><span>说明</span><b>点开就是该站真实搜索页，确认分类对不对</b></div>
                    </div>
                  </div>
                  <div class="sd-cookie-bar">
                    <span class="sd-cookie-res">预设确认入口未接：这里只读；确认状态来自私有包 site-search.local.json。</span>
                  </div>
                </template>

                                <template v-else-if="setTab === 'upload'">
                  <div class="set-fields">
                    <div class="sd-block cm-block">
                      <h4>分类映射</h4>
                      <p class="set-desc">{{ catKind === 'array' ? '站点分类 → 库内分类；保存后抓取轮转按这张表。' : '库内分类 → 目标站分类 ID；保存后发种按这张表填分类。' }}</p>
                      <div v-if="catRows.length" class="cm-list">
                        <div class="cm-row cm-head">
                          <span>{{ catKind === 'array' ? '站点分类' : '库内分类' }}</span>
                          <span>{{ catKind === 'array' ? '库内分类' : '目标站分类 ID' }}</span>
                          <span></span>
                        </div>
                        <div v-for="(r, i) in catRows" :key="i" class="cm-row">
                          <div v-if="catKind === 'array'" class="cm-src">
                            <input v-model="r.label" class="input" placeholder="分类名称">
                            <input v-model="r.id" class="input num" placeholder="ID">
                          </div>
                          <div v-else class="cm-src">
                            <input v-model="r.key" class="input" placeholder="库内分类，如 movie">
                          </div>
                          <select v-if="catKind === 'array'" v-model="r.purpose" class="select">
                            <option v-for="p in catPurposes" :key="p.v" :value="p.v">{{ p.label }}</option>
                          </select>
                          <input v-else v-model="r.id" class="input" placeholder="目标站分类 ID">
                          <button class="btn ghost slim cm-del" type="button" @click.stop="removeCatRow(i)">删除</button>
                        </div>
                      </div>
                      <div v-else class="sites-empty">这个站还没有分类映射；点「加一条」开始。</div>
                      <div class="cm-actions">
                        <button class="btn ghost slim" type="button" @click.stop="addCatRow">加一条</button>
                        <button class="btn primary slim" type="button" :disabled="catSaving" @click.stop="saveCatMap">{{ catSaving ? '保存中…' : '保存映射' }}</button>
                        <span class="sd-cookie-res">{{ catMsg }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="set-fields">
                    <div class="sd-block cm-block">
                      <h4>上传表单</h4>
                      <p class="set-desc">目标站上传页的字段映射；保存后发种按这张表填。识别只在你点按钮时发一次 GET。</p>
                      <div class="up-pair">
                        <label><span>提交路径</span><input v-model="upForm.path" class="input" placeholder="/takeupload.php"></label>
                        <label><span>识别页路径</span><input v-model="upForm.formPath" class="input" placeholder="/upload.php（留空用提交路径）"></label>
                        <label><span>文件字段</span><input v-model="upForm.fileField" class="input" placeholder="file"></label>
                      </div>
                      <div v-if="upForm.fields.length" class="cm-list">
                        <div class="cm-row cm-head"><span>目标字段</span><span>值模板</span><span></span></div>
                        <div v-for="(f, i) in upForm.fields" :key="i" class="cm-row">
                          <input v-model="f.name" class="input" placeholder="字段名">
                          <input v-model="f.template" class="input" placeholder="{title}">
                          <button class="btn ghost slim cm-del" type="button" @click.stop="removeUpField(i)">删除</button>
                        </div>
                      </div>
                      <div v-else class="sites-empty">还没有上传字段；点「从目标站识别」或「加字段」。</div>
                      <div class="cm-actions">
                        <button class="btn ghost slim" type="button" @click.stop="addUpField">加字段</button>
                        <button class="btn primary slim" type="button" :disabled="upSaving" @click.stop="saveUpForm">{{ upSaving ? '保存中…' : '保存上传映射' }}</button>
                        <button class="btn ghost slim" type="button" :disabled="detectBusy" @click.stop="detectRemote">{{ detectBusy ? '识别中…' : '从目标站识别' }}</button>
                        <span class="sd-cookie-res">{{ upMsg || detectMsg }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="set-fields">
                    <div class="set-field">
                      <div class="lbl"><span>站点定义 JSON</span><i>高级字段；存 data/site-defs，不进仓库</i></div>
                      <div class="ctl"><textarea v-model="defText" class="input sd-note" rows="10" placeholder="{}"></textarea></div>
                    </div>
                  </div>
                  <div class="sd-cookie-bar">
                    <button class="btn primary slim" type="button" :disabled="defSaving" @click.stop="saveDef">{{ defSaving ? '保存中…' : '保存定义' }}</button>
                    <span class="sd-cookie-res">{{ defMsg }}</span>
                  </div>
                </template>

                <template v-else>
                  <div class="set-fields">
                    <div class="set-field">
                      <div class="lbl"><span>单独设置本站</span></div>
                      <div class="ctl">
                        <button class="switch" :class="{ on: form.override }" type="button" @click.stop="form.override = !form.override"><i></i></button>
                      </div>
                    </div>
                  </div>
                  <div class="set-fields" :class="{ 'is-off': !form.override }">
                    <div class="set-field">
                      <div class="lbl"><span>抓取间隔</span></div>
                      <div class="ctl">
                        <select v-model="form.ovInterval" class="select">
                          <option value="">跟随全局</option>
                          <option value="1">1 分钟</option>
                          <option value="5">5 分钟</option>
                          <option value="15">15 分钟</option>
                          <option value="60">1 小时</option>
                          <option value="180">3 小时</option>
                        </select>
                      </div>
                    </div>
                    <div class="set-field">
                      <div class="lbl"><span>每天抓几次</span></div>
                      <div class="ctl"><input v-model="form.ovDaily" class="input num" inputmode="numeric" placeholder="留空＝跟随全局"></div>
                    </div>
                    <div class="set-field">
                      <div class="lbl"><span>抓详情页</span></div>
                      <div class="ctl">
                        <button class="switch" :class="{ on: form.ovDetail }" type="button" @click.stop="form.ovDetail = !form.ovDetail"><i></i></button>
                      </div>
                    </div>
                    <div class="set-field">
                      <div class="lbl"><span>优先级</span></div>
                      <div class="ctl">
                        <select v-model="form.priority" class="select">
                          <option value="high">高（先抓）</option>
                          <option value="normal">普通</option>
                          <option value="low">低（最后抓）</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div class="set-fields">
                    <div class="set-field">
                      <div class="lbl"><span>分类映射</span></div>
                      <div class="ctl"><span class="fixed-val ref">{{ catMapTxt(s) }}</span></div>
                    </div>
                  </div>
                </template>
              </div>
            </div>

            <div v-if="tab === 'settings'" class="sd-form-actions">
              <button class="btn primary slim" type="button" :disabled="busy.save" @click.stop="saveSite(s)">{{ busy.save ? '保存中…' : '保存设置' }}</button>
              <button class="btn ghost slim" type="button" :disabled="busy.save" @click.stop="resetSite(s)">恢复默认</button>
              <div class="spacer"></div>
              <button v-if="s.added" class="btn ghost slim danger" type="button" @click.stop="removeSite(s)">移除站点</button>
              <button v-else class="btn ghost slim danger" type="button" disabled title="基础清单站点不能移除；可恢复默认配置">移除站点</button>
            </div>
          </div>
        </template>
        <div v-if="!pageRows.length" class="sites-empty">没有匹配的站点</div>
      </div>
      <div class="sites-pager" id="sites-pager">
        <button class="btn ghost slim" :disabled="page <= 1" @click="page--">上一页</button>
        <span class="soft">第 {{ page }} / {{ pages }} 页 · 共 {{ filtered.length }} 站</span>
        <button class="btn ghost slim" :disabled="page >= pages" @click="page++">下一页</button>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="bulkOpen" class="modal-mask" id="site-bulk-modal">
        <div class="modal wide">
          <div class="modal-head">
            <h2>批量设置</h2>
            <button class="btn ghost slim" type="button" @click="bulkOpen = false">关闭</button>
          </div>
          <p class="modal-sub">只改你选过的项，其余保持原样；应用到已选的 <b>{{ picks.length }}</b> 个站点。</p>
          <div class="modal-scroll">
            <div class="sd-field"><span>覆盖全局抓取</span>
              <select v-model="bulkForm.ovr" class="select"><option value="keep">不改</option><option value="on">开启</option><option value="off">关闭</option></select></div>
            <div class="sd-field"><span>抓取间隔</span>
              <select v-model="bulkForm.iv" class="select"><option value="keep">不改</option><option value="">抓完全部</option><option value="1">1 分钟</option><option value="5">5 分钟</option><option value="15">15 分钟</option><option value="60">1 小时</option></select></div>
            <div class="sd-field"><span>单站每日上限</span><input v-model="bulkForm.daily" class="input" placeholder="留空＝不改"></div>
            <div class="sd-field"><span>抓详情页</span>
              <select v-model="bulkForm.det" class="select"><option value="keep">不改</option><option value="on">开启</option><option value="off">关闭</option></select></div>
            <div class="sd-field"><span>站点优先级</span>
              <select v-model="bulkForm.prio" class="select"><option value="keep">不改</option><option value="high">高（先抓）</option><option value="normal">普通</option><option value="low">低（最后抓）</option></select></div>
          </div>
          <div class="modal-foot">
            <button class="btn ghost slim" type="button" @click="bulkOpen = false">取消</button>
            <button class="btn primary slim" type="button" :disabled="busy.bulk" @click="applyBulk">{{ busy.bulk ? '应用中…' : '应用到已选' }}</button>
          </div>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="addOpen" class="modal-mask" id="site-add-modal">
        <div class="modal">
          <div class="modal-head">
            <h2>添加站点</h2>
            <button class="btn ghost slim" type="button" @click="addOpen = false">关闭</button>
          </div>
          <label class="field"><span>站点地址</span>
            <input v-model="addForm.url" class="input" placeholder="https://example.org/index.php" autocomplete="off"></label>
          <label class="field"><span>架构</span>
            <select v-model="addForm.arch" class="select">
              <option value="?">未确认</option>
              <option value="NP">NexusPHP</option>
              <option value="UNIT3D">UNIT3D</option>
              <option value="GZ">Gazelle</option>
              <option value="OTHER">其它</option>
            </select></label>
          <label class="field"><span>名称（可选）</span>
            <input v-model="addForm.title" class="input" placeholder="留空就用域名"></label>
          <div class="modal-foot">
            <button class="btn ghost slim" type="button" @click="addOpen = false">取消</button>
            <button class="btn primary slim" type="button" @click="addSite">添加</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

const PER_PAGE = 11
const ARCH = {
  NP: ['np', 'NexusPHP'], UNIT3D: ['u3d', 'UNIT3D'], GZ: ['gz', 'Gazelle'],
  OTHER: ['oth', '其它'], '?': ['unk', '未确认'], U3D: ['u3d', 'UNIT3D']
}
const ENG_CODE = { nexusphp: 'NP', unit3d: 'U3D', gazelle: 'GZ' }
const archOptions = [
  { v: 'NP', label: 'NexusPHP' }, { v: 'UNIT3D', label: 'UNIT3D' }, { v: 'GZ', label: 'Gazelle' },
  { v: 'OTHER', label: '其它' }, { v: '?', label: '未确认' }
]
const setTabs = [{ v: 'login', label: '登录' }, { v: 'search', label: '搜索预设' }, { v: 'upload', label: '上传配置' }, { v: 'override', label: '站点覆盖' }]

const baseSites = ref([])
const configs = ref({})
const hidden = ref([])
const presets = ref({})
const defs = ref({})
const creds = ref({})
const crawlState = ref({})
const statusMap = ref({})
const q = ref('')
const statusFilter = ref('all')
const archFilter = ref('all')
const loginFilter = ref('all')
const presetFilter = ref('all')
const crawlFilter = ref('all')
const picks = ref([])
const page = ref(1)
const sel = ref(null)
const tab = ref('overview')
const setTab = ref('login')
const detail = reactive({ def: null, preset: null, catalog: null, items: [] })
const form = reactive({ url: '', cookie: '', override: false, ovInterval: '', ovDaily: '', ovDetail: false, priority: 'normal' })
const defText = ref('')
const defSaving = ref(false)
const defMsg = ref('')
const catKind = ref('object')
const catRows = ref([])
const catSaving = ref(false)
const catMsg = ref('')
const upForm = reactive({ path: '', formPath: '', fileField: '', fields: [] })
const upSaving = ref(false)
const upMsg = ref('')
const detectBusy = ref(false)
const detectMsg = ref('')
const catPurposes = [
  { v: 'movie', label: '电影' },
  { v: 'tv', label: '剧集' },
  { v: 'doc', label: '纪录片' },
  { v: 'anime', label: '动漫' },
  { v: 'music', label: '音乐' },
  { v: 'sport', label: '体育' },
  { v: 'game', label: '游戏' },
  { v: 'book', label: '电子书' },
  { v: 'software', label: '软件' },
  { v: 'adult', label: '成人' },
  { v: 'other', label: '其他' }
]
const addOpen = ref(false)
const addForm = reactive({ url: '', arch: '?', title: '' })
const busy = reactive({ selfcheck: false, crawl: false, save: false, bulk: false })
const bulkOpen = ref(false)
const bulkForm = reactive({ ovr: 'keep', iv: 'keep', daily: '', det: 'keep', prio: 'keep' })
let loaded = false
let loadBusy = false
let bootTimer = null
let qTimer = null

function toast(msg) {
  if (window.PTA && window.PTA.toast) window.PTA.toast(msg)
}
function confirmBox(title, text, fn) {
  if (window.PTA && window.PTA.confirm) window.PTA.confirm(title, text, fn)
  else if (window.confirm(title + '\n\n' + text)) fn()
}
function loggedIn() { return !document.querySelector('#login-mask') }
function visible() {
  const v = document.querySelector('[data-view="sites"]')
  return !!(v && !v.hidden)
}
function fmtWhen(raw) {
  if (!raw) return '—'
  const t = typeof raw === 'number' ? new Date(raw) : new Date(String(raw))
  if (isNaN(t.getTime())) return '—'
  const p2 = n => String(n).padStart(2, '0')
  const now = new Date()
  const sameDay = t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth() && t.getDate() === now.getDate()
  return (sameDay ? '今日 ' : p2(t.getMonth() + 1) + '-' + p2(t.getDate()) + ' ') + p2(t.getHours()) + ':' + p2(t.getMinutes())
}
function initials(s) {
  const m = String(s.title || s.name).match(/^[A-Za-z0-9]+/)
  return m ? m[0].slice(0, 2).toUpperCase() : String(s.title || s.name).slice(0, 1)
}
function archOf(s) { return ARCH[s.arch] || ARCH['?'] }
function archCls(s) { return archOf(s)[0] }
function archLabel(s) { return archOf(s)[1] }
function dotCls(s) { return s.login === 'ok' ? 'ok' : s.login === 'fail' ? 'bad' : 'idle' }
function loginTxt(s) { return s.login === 'ok' ? '可用' : s.login === 'fail' ? '失效' : '未自检' }
function modeTxt(s) {
  if (!s.enabled) return '停用'
  if (s.mode === 'full') return '全量'
  if (s.mode === 'mixed') return '增量+定期全量'
  return '增量'
}
function presetTxt(s) {
  if (!s.preset) return '—'
  const code = ENG_CODE[s.preset.engine] || (s.preset.engine || '').toUpperCase() || '?'
  return code + (s.preset.groups ? ' ' + s.preset.groups + '组' : '') + (s.preset.confirmed ? '' : ' · 待确认')
}
function lastCrawlTxt(s) { return s.lastAt ? fmtWhen(s.lastAt) : '未抓取' }
function cookieWhen(s) { return s.cookieUpdatedAt ? ' · ' + fmtWhen(s.cookieUpdatedAt) : '' }

const sites = computed(() => baseSites.value
  .filter(x => !hidden.value.includes(x.host))
  .map(x => {
    const c = configs.value[x.host] || {}
    const st = statusMap.value[x.host] || null
    const cr = crawlState.value[x.host] || {}
    const cd = creds.value[x.host] || null
    return {
      name: x.host,
      title: x.title || x.host,
      url: c.url || x.url || ('https://' + x.host),
      arch: c.arch || x.arch || '?',
      enabled: c.enabled !== false,
      mode: c.mode || 'incremental',
      override: !!c.override,
      ovInterval: c.ovInterval == null ? '' : String(c.ovInterval),
      ovDaily: c.ovDaily == null ? '' : String(c.ovDaily),
      ovDetail: !!c.ovDetail,
      priority: c.priority || 'normal',
      config: c,
      cookieSaved: !!(cd && cd.hasCookie),
      cookieUpdatedAt: (cd && cd.updatedAt) || '',
      login: st ? (st.pass ? 'ok' : 'fail') : 'none',
      loginAt: st ? st.at : '',
      lastAt: Number(cr.lastAt) || 0,
      todayCount: Number(cr.dayCount) || 0,
      preset: presets.value[x.host] || null,
      def: defs.value[x.host] || null
    }
  }))

const filtered = computed(() => sites.value.filter(s => {
  if (statusFilter.value === 'on' && !s.enabled) return false
  if (statusFilter.value === 'off' && s.enabled) return false
  if (archFilter.value !== 'all' && (s.arch || '?') !== archFilter.value) return false
  if (loginFilter.value !== 'all' && s.login !== loginFilter.value) return false
  if (presetFilter.value !== 'all') {
    const p = s.preset
    if (presetFilter.value === 'confirmed' && !(p && p.confirmed)) return false
    if (presetFilter.value === 'pending' && !(p && !p.confirmed)) return false
    if (presetFilter.value === 'nocats' && !(p && !p.ids)) return false
  }
  if (crawlFilter.value !== 'all') {
    if (crawlFilter.value === 'crawled' && !s.lastAt) return false
    if (crawlFilter.value === 'never' && s.lastAt) return false
    if (crawlFilter.value === 'today' && !s.todayCount) return false
  }
  const needle = q.value.trim().toLowerCase()
  if (needle && (s.title + ' ' + s.name + ' ' + s.url).toLowerCase().includes(needle) === false) return false
  return true
}))
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PER_PAGE)))
const pageRows = computed(() => filtered.value.slice((page.value - 1) * PER_PAGE, page.value * PER_PAGE))
const statusTabs = computed(() => [
  { v: 'all', label: '全部', n: sites.value.length },
  { v: 'on', label: '启用', n: sites.value.filter(s => s.enabled).length },
  { v: 'off', label: '停用', n: sites.value.filter(s => !s.enabled).length }
])
const allPicked = computed(() => pageRows.value.length > 0 && pageRows.value.every(s => picks.value.includes(s.name)))
const somePicked = computed(() => pageRows.value.some(s => picks.value.includes(s.name)) && !allPicked.value)
const cookieCount = computed(() => sites.value.filter(s => s.cookieSaved).length)
const stats = computed(() => {
  const list = sites.value
  const total = list.length || 1
  const count = { NP: 0, UNIT3D: 0, GZ: 0, OTHER: 0, '?': 0 }
  list.forEach(s => {
    const k = ['NP', 'UNIT3D', 'GZ', 'OTHER'].includes(s.arch) ? s.arch : '?'
    count[k]++
  })
  const names = { NP: 'NexusPHP', UNIT3D: 'UNIT3D', GZ: 'Gazelle', OTHER: '其它', '?': '未确认' }
  const colors = { NP: '#4f46e5', UNIT3D: '#6b62e8', GZ: '#8b84ee', OTHER: '#b3adf3', '?': '#c9cedb' }
  const order = ['NP', 'UNIT3D', 'GZ', 'OTHER', '?']
  const segs = order.filter(k => count[k]).map(k => ({ w: (count[k] / total * 100).toFixed(2), color: colors[k] }))
  const legend = order.filter(k => count[k]).map(k => ({ name: names[k], count: count[k], color: colors[k] }))
  const defList = Object.keys(defs.value).map(h => defs.value[h]).filter(Boolean)
  const withCats = defList.filter(d => Object.keys(d.cats || {}).length > 0).length
  const eng = {}
  defList.forEach(d => { const k = d.engine || '?'; eng[k] = (eng[k] || 0) + 1 })
  const ps = Object.keys(presets.value).map(h => presets.value[h]).filter(Boolean)
  const confirmed = ps.filter(p => p.confirmed).length
  let cov = '已适配 ' + defList.length + ' 站 · 有分类 ' + withCats + ' 站'
  if (defList.length) cov += '（NP ' + (eng.nexusphp || 0) + ' · U3D ' + (eng.unit3d || 0) + ' · GZ ' + (eng.gazelle || 0) + '）'
  if (ps.length) cov += ' · 预设已确认 ' + confirmed + ' / ' + ps.length
  return {
    total: list.length,
    enabled: list.filter(s => s.enabled).length,
    loginFail: list.filter(s => s.login === 'fail').length,
    unknown: list.filter(s => s.login === 'none').length,
    segs, legend, cov
  }
})
const catGroups = computed(() => {
  const d = detail.def || {}
  const p = detail.preset || {}
  const groups = (p.cats && Object.keys(p.cats).length ? p.cats : d.cats) || {}
  return Object.keys(groups).map(name => ({ name, ids: (groups[name] || []).join(', ') || '—' }))
})
const previewUrls = computed(() => {
  const d = detail.def || {}
  const p = detail.preset || {}
  const groups = (p.cats && Object.keys(p.cats).length ? p.cats : d.cats) || {}
  const params = d.params || {}
  const sp = d.searchPath || ''
  const base = String(d.base || '').replace(/\/+$/, '')
  if (!base || !sp || !Object.keys(params).length) return []
  const out = []
  Object.keys(groups).slice(0, 8).forEach(g => {
    const first = (groups[g] || [])[0]
    if (first === undefined || first === '') return
    const qs = Object.keys(params).map(k => {
      const v = String(params[k]).split('{cats}').join(String(first)).split('{q}').join('')
      return encodeURIComponent(k) + '=' + encodeURIComponent(v)
    }).join('&')
    const url = base + sp + '?' + qs
    out.push({ tag: g, url, short: url.replace(/^https?:\/\//, '') })
  })
  return out.slice(0, 6)
})

watch([q, statusFilter, archFilter, loginFilter, presetFilter, crawlFilter], () => { page.value = 1 })
watch(pages, p => { if (page.value > p) page.value = p })
watch(q, () => {
  if (qTimer) clearTimeout(qTimer)
  qTimer = setTimeout(() => { page.value = 1 }, 200)
})

function togglePick(host) {
  const i = picks.value.indexOf(host)
  if (i >= 0) picks.value.splice(i, 1)
  else picks.value.push(host)
}
function toggleAll(e) {
  const on = e.target.checked
  pageRows.value.forEach(s => {
    const i = picks.value.indexOf(s.name)
    if (on && i < 0) picks.value.push(s.name)
    if (!on && i >= 0) picks.value.splice(i, 1)
  })
}
async function loadAll() {
  if (loadBusy || !loggedIn()) return
  loadBusy = true
  try {
    const [sj, cj, pj, dj, crj, csj] = await Promise.all([
      fetch('/api/sites', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/site-config', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/site-search', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/site-defs', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/credentials', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/crawl/status', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).catch(() => null)
    ])
    if (sj && sj.ok) {
      baseSites.value = Array.isArray(sj.data.sites) ? sj.data.sites : []
      statusMap.value = sj.data.status || {}
    }
    if (cj && cj.ok) {
      configs.value = cj.data.sites || {}
      hidden.value = Array.isArray(cj.data.hidden) ? cj.data.hidden : []
    }
    if (pj && pj.ok && pj.data && typeof pj.data === 'object') presets.value = pj.data
    if (dj && dj.ok) {
      const out = {}
      if (Array.isArray(dj.data)) dj.data.forEach(d => { if (d && d.host) out[d.host] = d })
      else if (dj.data && typeof dj.data === 'object') Object.keys(dj.data).forEach(h => { out[h] = dj.data[h] })
      defs.value = out
    }
    if (crj && crj.ok && Array.isArray(crj.data)) {
      const out = {}
      crj.data.forEach(c => { if (c && c.host) out[c.host] = c })
      creds.value = out
    }
    if (csj && csj.ok && csj.data && csj.data.state) crawlState.value = csj.data.state
    loaded = true
  } catch (e) {}
  loadBusy = false
}
function ensure() {
  if (visible() && loggedIn()) loadAll()
}
async function loadDetail(host) {
  detail.def = null
  detail.preset = null
  detail.catalog = null
  detail.items = []
  try {
    const [dj, pj, cj] = await Promise.all([
      fetch('/api/site-def/' + encodeURIComponent(host), { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/sites/' + encodeURIComponent(host) + '/search', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/catalog?site=' + encodeURIComponent(host) + '&limit=6', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).catch(() => null)
    ])
    if (sel.value !== host) return
    if (dj && dj.ok) { detail.def = dj.data; syncCatRows(detail.def); syncUpForm(detail.def) }
    if (pj && pj.ok) detail.preset = (pj.data && pj.data.preset) || null
    if (cj && cj.ok) {
      detail.catalog = { total: cj.data.total || 0, byStatus: cj.data.byStatus || {} }
      detail.items = cj.data.items || []
    }
  } catch (e) {}
}
function fillForm(s) {
  form.url = s.url
  form.cookie = ''
  form.override = s.override
  form.ovInterval = s.ovInterval
  form.ovDaily = s.ovDaily
  form.ovDetail = s.ovDetail
  form.priority = s.priority
}
function openSite(host) {
  sel.value = host
  tab.value = 'overview'
  setTab.value = 'login'
  const s = sites.value.find(x => x.name === host)
  if (s) fillForm(s)
  loadDetail(host)
  loadDef(host)
}
async function loadDef(host) {
  defMsg.value = ''
  try {
    const r = await fetch('/api/site-def/' + encodeURIComponent(host), { credentials: 'same-origin' })
    if (r.ok) {
      const j = await r.json()
      if (j && j.ok) { defText.value = JSON.stringify(j.data, null, 2); syncCatRows(j.data); syncUpForm(j.data); return }
    }
  } catch (e) {}
  const s = sites.value.find(x => x.name === host)
  const tpl = { engine: (s && s.def && s.def.engine) || 'nexusphp', base: (s && s.url) || ('https://' + host),
    uploadMap: { path: '/takeupload.php', formPath: '/upload.php', fileField: 'file', fields: { name: '{title}', descr: '{description}', type: '{catId}', anon: '{anonymous}' } },
    verify: { path: '/torrents.php?search={title}' }, catMap: {} }
  defText.value = JSON.stringify(tpl, null, 2)
  defMsg.value = '还没有站点定义，这是模板；按站修改后保存'
}
async function saveDef() {
  if (!sel.value || defSaving.value) return
  let def
  try { def = JSON.parse(defText.value) } catch (e) { toast('JSON 格式不对'); return }
  defSaving.value = true
  try {
    const j = await (await fetch('/api/site-def/' + encodeURIComponent(sel.value), {
      method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(def)
    })).json()
    if (j && j.ok) {
      detail.def = def
      syncCatRows(def)
      syncUpForm(def)
      defMsg.value = '已保存'
      toast('站点定义已保存')
    } else { defMsg.value = (j && j.error && j.error.message) || '保存失败'; toast(defMsg.value) }
  } catch (e) { toast('保存请求发不出去') }
  defSaving.value = false
}

function catRowsFromDef(def) {
  if (!def) return { kind: 'object', rows: [] }
  const cm = def.catMap
  if (Array.isArray(cm)) {
    return { kind: 'array', rows: cm.map(function (x) {
      return { id: String((x && x.id) || ''), label: String((x && x.label) || ''), purpose: String((x && x.purpose) || 'other') }
    }) }
  }
  if (cm && typeof cm === 'object') {
    return { kind: 'object', rows: Object.keys(cm).map(function (k) {
      return { key: String(k), id: String(cm[k] == null ? '' : cm[k]) }
    }) }
  }
  return { kind: 'object', rows: [] }
}
function syncCatRows(def) {
  const s = catRowsFromDef(def)
  catKind.value = s.kind
  catRows.value = s.rows
  catMsg.value = ''
}
function addCatRow() {
  if (catKind.value === 'array') catRows.value.push({ id: '', label: '', purpose: 'other' })
  else catRows.value.push({ key: '', id: '' })
}
function removeCatRow(i) {
  catRows.value.splice(i, 1)
}
async function saveCatMap() {
  if (!sel.value || catSaving.value) return
  let def
  try { def = JSON.parse(defText.value) } catch (e) { catMsg.value = '上面的 JSON 格式不对，先修好再保存映射'; return }
  if (!def || typeof def !== 'object' || Array.isArray(def)) { catMsg.value = '站点定义必须是 JSON 对象'; return }
  const rows = catRows.value.map(function (r) { return Object.assign({}, r) })
  if (catKind.value === 'array') {
    const seen = {}
    for (const r of rows) {
      r.id = String(r.id || '').trim()
      r.label = String(r.label || '').trim()
      r.purpose = String(r.purpose || 'other')
      if (!r.id || !r.label) { catMsg.value = '站点分类的名称和 ID 都要填'; return }
      if (seen[r.id]) { catMsg.value = '分类 ID 重复：' + r.id; return }
      seen[r.id] = true
      if (!catPurposes.some(function (p) { return p.v === r.purpose })) r.purpose = 'other'
    }
    def.catMap = rows
    const cats = {}
    rows.forEach(function (r) { (cats[r.purpose] = cats[r.purpose] || []).push(r.id) })
    def.cats = cats
  } else {
    const seen = {}
    const obj = {}
    for (const r of rows) {
      const key = String(r.key || '').trim()
      const id = String(r.id || '').trim()
      if (!key || !id) { catMsg.value = '库内分类和目标站分类 ID 都要填'; return }
      if (seen[key]) { catMsg.value = '库内分类重复：' + key; return }
      seen[key] = true
      obj[key] = id
    }
    def.catMap = obj
  }
  catSaving.value = true
  try {
    const j = await (await fetch('/api/site-def/' + encodeURIComponent(sel.value), {
      method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(def)
    })).json()
    if (j && j.ok) {
      const saved = (j.data && j.data.def) || def
      detail.def = saved
      defText.value = JSON.stringify(saved, null, 2)
      syncCatRows(saved)
      catMsg.value = '已保存 · ' + rows.length + ' 条'
      toast('分类映射已保存')
      if (defs.value && defs.value[sel.value]) {
        const cats = saved.cats || {}
        defs.value[sel.value] = Object.assign({}, defs.value[sel.value], {
          groups: Object.keys(cats).length,
          ids: Object.keys(cats).reduce(function (a, k) { return a + (cats[k] || []).length }, 0),
          cats: cats
        })
      }
    } else { catMsg.value = (j && j.error && j.error.message) || '保存失败'; toast(catMsg.value) }
  } catch (e) { catMsg.value = '保存请求发不出去'; toast(catMsg.value) }
  catSaving.value = false
}
function syncUpForm(def) {
  const um = (def && def.uploadMap) || {}
  upForm.path = String(um.path || '')
  upForm.formPath = String(um.formPath || '')
  upForm.fileField = String(um.fileField || '')
  upForm.fields = Object.keys(um.fields || {}).map(function (k) {
    return { name: k, template: String(um.fields[k] == null ? '' : um.fields[k]) }
  })
  upMsg.value = ''
  detectMsg.value = ''
}
function addUpField() {
  upForm.fields.push({ name: '', template: '' })
}
function removeUpField(i) {
  upForm.fields.splice(i, 1)
}
async function saveUpForm() {
  if (!sel.value || upSaving.value) return
  let def
  try { def = JSON.parse(defText.value) } catch (e) { upMsg.value = '上面的 JSON 格式不对，先修好再保存上传映射'; return }
  if (!def || typeof def !== 'object' || Array.isArray(def)) { upMsg.value = '站点定义必须是 JSON 对象'; return }
  const fields = {}
  for (const f of upForm.fields) {
    const name = String(f.name || '').trim()
    if (!name) { upMsg.value = '每个字段都要填字段名'; return }
    if (fields[name] !== undefined) { upMsg.value = '字段名重复：' + name; return }
    fields[name] = String(f.template || '')
  }
  def.uploadMap = Object.assign({}, def.uploadMap || {}, {
    path: String(upForm.path || '').trim(),
    formPath: String(upForm.formPath || '').trim(),
    fileField: String(upForm.fileField || '').trim(),
    fields: fields
  })
  upSaving.value = true
  try {
    const j = await (await fetch('/api/site-def/' + encodeURIComponent(sel.value), {
      method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(def)
    })).json()
    if (j && j.ok) {
      const saved = (j.data && j.data.def) || def
      detail.def = saved
      defText.value = JSON.stringify(saved, null, 2)
      syncUpForm(saved)
      upMsg.value = '已保存 · ' + Object.keys(fields).length + ' 个字段'
      toast('上传映射已保存')
    } else { upMsg.value = (j && j.error && j.error.message) || '保存失败'; toast(upMsg.value) }
  } catch (e) { upMsg.value = '保存请求发不出去'; toast(upMsg.value) }
  upSaving.value = false
}
function detectRemote() {
  if (!sel.value || detectBusy.value) return
  const host = sel.value
  confirmBox('识别上传表单', '会向 ' + host + ' 的上传页发一次 GET，只读页面，不提交任何东西。继续？', async function () {
    detectBusy.value = true
    detectMsg.value = ''
    try {
      const j = await (await fetch('/api/targets/' + encodeURIComponent(host) + '/detect-form', {
        method: 'POST', credentials: 'same-origin'
      })).json()
      if (!j || !j.ok) {
        detectMsg.value = ((j && j.error && j.error.message) || '识别失败') + '；可以继续手工编辑字段表'
        detectBusy.value = false
        return
      }
      const d = j.data || {}
      if (d.path) upForm.path = d.path
      if (d.formPath) upForm.formPath = d.formPath
      if (d.fileField) upForm.fileField = d.fileField
      upForm.fields = (d.fields || []).map(function (f) { return { name: f.name, template: f.template || '' } })
      detectMsg.value = '识别到 ' + upForm.fields.length + ' 个字段 · ' + (d.url || d.path || '')
      toast('已识别上传表单')
    } catch (e) { detectMsg.value = '识别请求发不出去' }
    detectBusy.value = false
  })
}

function openAdd() { addForm.url = ''; addForm.arch = '?'; addForm.title = ''; addOpen.value = true }
async function addSite() {
  if (!addForm.url.trim()) { toast('先填站点地址'); return }
  try {
    const j = await (await fetch('/api/sites', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: addForm.url.trim(), arch: addForm.arch, title: addForm.title.trim() })
    })).json()
    if (!j || !j.ok) { toast((j && j.error && j.error.message) || '添加失败'); return }
    addOpen.value = false
    await loadAll()
    openSite(j.data.host)
    toast('已添加：' + j.data.host)
  } catch (e) { toast('添加请求发不出去') }
}
function removeSite(s) {
  confirmBox('移除站点', '会删除面板里添加的站点和凭据；基础清单站点不能删。继续？', async () => {
    try {
      const j = await (await fetch('/api/sites/' + encodeURIComponent(s.name), { method: 'DELETE', credentials: 'same-origin' })).json()
      if (j && j.ok) { sel.value = null; await loadAll(); toast('已移除：' + s.name) }
      else toast((j && j.error && j.error.message) || '移除失败')
    } catch (e) { toast('移除请求发不出去') }
  })
}
function closeSheet() { sel.value = null }

async function patchConfig(host, patch) {
  try {
    const j = await (await fetch('/api/site-config/' + encodeURIComponent(host), {
      method: 'PUT', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch)
    })).json()
    if (j && j.ok) { await loadAll(); return true }
    toast((j && j.error && j.error.message) || '设置保存失败')
  } catch (e) { toast('设置请求发不出去') }
  return false
}
async function toggleEnabled(s) {
  const ok = await patchConfig(s.name, { enabled: !s.enabled })
  if (ok) toast(s.enabled ? '已停用 ' + s.name : '已启用 ' + s.name)
}
async function setArch(s, e) {
  const ok = await patchConfig(s.name, { arch: e.target.value })
  if (ok) toast('架构已改为 ' + e.target.value)
}
async function saveSite(s) {
  if (busy.save) return
  busy.save = true
  const body = {
    url: form.url,
    override: !!form.override,
    ovInterval: form.ovInterval,
    ovDaily: form.ovDaily,
    ovDetail: !!form.ovDetail,
    priority: form.priority
  }
  const ok = await patchConfig(s.name, body)
  if (ok) {
    const cookie = String(form.cookie || '').trim()
    if (cookie) {
      try {
        const j = await (await fetch('/api/credentials/' + encodeURIComponent(s.name), {
          method: 'PUT', credentials: 'same-origin',
          headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cookie })
        })).json()
        if (j && j.ok) {
          form.cookie = ''
          toast('设置与 cookie 都已保存，正在自检…')
          await loadAll()
          const fresh = sites.value.find(x => x.name === s.name)
          if (fresh) selfcheckOne(fresh)
        } else toast((j && j.error && j.error.message) || 'cookie 没存进服务端')
      } catch (e) { toast('cookie 请求发不出去') }
    } else toast('设置已保存')
    await loadAll()
    if (sel.value === s.name) {
      const fresh = sites.value.find(x => x.name === s.name)
      if (fresh) fillForm(fresh)
      loadDetail(s.name)
    }
  }
  busy.save = false
}
function resetSite(s) {
  confirmBox('恢复默认', '会清掉「' + s.name + '」的服务端配置，回到站点清单里的默认值。继续？', async () => {
    try {
      const j = await (await fetch('/api/site-config/' + encodeURIComponent(s.name), { method: 'DELETE', credentials: 'same-origin' })).json()
      if (j && j.ok) {
        toast('已恢复默认')
        await loadAll()
        const fresh = sites.value.find(x => x.name === s.name)
        if (fresh) fillForm(fresh)
      } else toast((j && j.error && j.error.message) || '恢复失败')
    } catch (e) { toast('恢复请求发不出去') }
  })
}
async function selfcheckOne(s) {
  if (busy.selfcheck || !s.cookieSaved) return
  busy.selfcheck = true
  try {
    const j = await (await fetch('/api/sites/' + encodeURIComponent(s.name) + '/session-test', { method: 'POST', credentials: 'same-origin' })).json()
    if (j && j.ok) toast(j.data.pass ? 'cookie 可用' : 'cookie 失效，重新导入后再试')
    else toast((j && j.error && j.error.message) || '自检失败')
    await loadAll()
  } catch (e) { toast('自检请求发不出去') }
  busy.selfcheck = false
}
async function selfcheckAll() {
  if (busy.selfcheck) return
  const hosts = sites.value.filter(s => s.cookieSaved).map(s => s.name)
  if (!hosts.length) { toast('还没有站点存过 cookie'); return }
  busy.selfcheck = true
  let ok = 0, bad = 0
  for (const host of hosts) {
    try {
      const j = await (await fetch('/api/sites/' + encodeURIComponent(host) + '/session-test', { method: 'POST', credentials: 'same-origin' })).json()
      if (j && j.ok && j.data && j.data.pass) ok++
      else bad++
    } catch (e) { bad++ }
  }
  busy.selfcheck = false
  toast('自检完成：可用 ' + ok + ' · 失效 ' + bad)
  await loadAll()
}
async function crawlOne(s) {
  if (busy.crawl) return
  busy.crawl = true
  try {
    const j = await (await fetch('/api/crawl/run', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ siteHost: s.name, dryRun: false })
    })).json()
    if (j && j.ok) toast('抓取完成：第 ' + (j.data.page || 0) + ' 页 · 新增 ' + (j.data.added || 0) + ' 条')
    else toast((j && j.error && j.error.message) || '抓取失败')
    await loadAll()
    if (sel.value === s.name) loadDetail(s.name)
  } catch (e) { toast('抓取请求发不出去') }
  busy.crawl = false
}
function openBulk() {
  if (!picks.value.length) return
  bulkForm.ovr = 'keep'
  bulkForm.iv = 'keep'
  bulkForm.daily = ''
  bulkForm.det = 'keep'
  bulkForm.prio = 'keep'
  bulkOpen.value = true
}
async function applyBulk() {
  if (busy.bulk) return
  busy.bulk = true
  let n = 0
  for (const host of picks.value.slice()) {
    const patch = {}
    if (bulkForm.ovr !== 'keep') patch.override = bulkForm.ovr === 'on'
    if (bulkForm.iv !== 'keep') patch.ovInterval = bulkForm.iv
    if (String(bulkForm.daily || '').trim()) patch.ovDaily = String(bulkForm.daily).trim()
    if (bulkForm.det !== 'keep') patch.ovDetail = bulkForm.det === 'on'
    if (bulkForm.prio !== 'keep') patch.priority = bulkForm.prio
    try {
      const j = await (await fetch('/api/site-config/' + encodeURIComponent(host), {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch)
      })).json()
      if (j && j.ok) n++
    } catch (e) {}
  }
  busy.bulk = false
  bulkOpen.value = false
  picks.value = []
  toast('已应用到 ' + n + ' 个站点')
  await loadAll()
}
function engineTxt(s) {
  const raw = (detail.preset && detail.preset.engine) || (detail.def && detail.def.engine) || (s.def && s.def.engine) || ''
  return raw ? (ENG_CODE[raw] || raw.toUpperCase()) + ' · ' + raw : '未识别'
}
function sourceTxt(s) {
  const src = (detail.preset && detail.preset.source) || ''
  if (!src) return '还没有预设'
  if (src === 'auto') return '采样自动生成，还没人工确认'
  if (src === 'arch') return '按清单架构推断，还没采样'
  if (src === 'manual') return '人工确认过的'
  return src
}
function paramTxt(s) {
  const d = detail.def || {}
  const mode = d.catMode || ''
  const param = Object.keys(d.params || {}).find(k => String(d.params[k]).indexOf('{cats}') >= 0) || ''
  if (!mode && !param) return Object.keys(catGroups.value).length ? 'cat（按分类 id 筛）' : '—'
  return (mode || '—') + (param ? ' · ' + param : '')
}
function crawlTxt(s) {
  if (!s.lastAt) return '还没抓过'
  return '上次 ' + fmtWhen(s.lastAt) + ' · 今日 ' + s.todayCount + ' 次'
}
function catalogTxt(s) {
  const c = detail.catalog
  if (!c || !c.total) return '这个站还没有词条'
  const b = c.byStatus || {}
  return '共 ' + c.total + ' 条 · 待筛选 ' + (b.new || 0) + ' · 已送审 ' + (b.selected || 0) + ' · 已发 ' + (b.published || 0)
}
function sampleTxt(s) {
  const d = detail.def
  if (!d) return s.def ? (s.def.groups || 0) + ' 组分类' : '还没采样'
  const rows = (d.source && d.source.rows) || 0
  const groups = Object.keys(d.cats || {}).length
  return rows + ' 行 · ' + groups + ' 组分类'
}
function kindTxt(s) {
  const d = detail.def
  const kind = d && d.source && d.source.kind
  if (!d) return '没有定义'
  if (kind === 'sample') return '采样确认'
  if (kind === 'shell') return '引擎按页面特征确认，分类待补'
  if (kind === 'arch') return '按清单架构推断，还没采样'
  return d.engine ? '引擎已确认，分类待补' : '按清单架构推断，还没采样'
}
function catRangeTxt(s) {
  const groups = (detail.preset && detail.preset.groups) || (s.def && s.def.groups) || 0
  return groups ? groups + ' 组分类' : '还没有分类'
}
function catMapTxt(s) {
  const cm = detail.def && detail.def.catMap
  const n = Array.isArray(cm) ? cm.length : (cm && typeof cm === 'object' ? Object.keys(cm).length : 0)
  return n ? '已配 ' + n + ' 条' : '未配置'
}

onMounted(() => {
  window.addEventListener('hashchange', ensure)
  document.addEventListener('keydown', onKey)
  bootTimer = setInterval(() => { if (!loaded) ensure() }, 1500)
  ensure()
})
onUnmounted(() => {
  window.removeEventListener('hashchange', ensure)
  document.removeEventListener('keydown', onKey)
  if (bootTimer) clearInterval(bootTimer)
  if (qTimer) clearTimeout(qTimer)
})
function onKey(e) {
  if (e.key === 'Escape' && sel.value) closeSheet()
}
</script>
