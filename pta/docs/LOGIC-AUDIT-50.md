# 50 轮逻辑审计

| # | 模块 | 假设 | 结论 | 说明 |
|---|---|---|---|---|
| 1 | crawl | 类型变更后 type-skipped 词条能否重审 | confirmed | 已修：重置 类型不符/未知 到 new |
| 2 | routes | 改标题/目标站后旧查重缓存是否失效 | confirmed | 已修：清 dupe 缓存 |
| 3 | screen | 数字分类无映射是否放行 | confirmed | 已修：类型未知拦截 |
| 4 | qb | v2 密文下载器密码是否可读 | confirmed | 已修：dlPass 支持 v1/v2 |
| 5 | scheduler-dedupe | 查重失败是否被标记通过 | confirmed | 已修：errors/disabled 不写 dupePassedAt |
| 6 | scheduler-crawl | 轮转外站点 waiting 是否漏算 | confirmed | 已修：waiting=allSites-sites |
| 7 | scheduler-crawl | 单站失败是否同时算成功 | confirmed | 已修：failed 优先 |
| 8 | scheduler-retry | 重试成功后是否残留 nextRetryAt/retries | confirmed | 已修：成功清重试标记 |
| 9 | routes-misc | 手动送审查重失败是否标记通过 | confirmed | 已修：errors 不写 dupePassedAt |
| 10 | routes-write | action=retry 是否清 failed 阶段 | confirmed | 已修：回到合法阶段 |
| 11 | routes-write | 坏数据缺 id 时 UPDATE 用 undefined | confirmed | 已修：it.id 强制写回 |
| 12 | target-service | uploadMany 重复 host 是否重复上传 | confirmed | 已修：host 去重 |
| 13 | config | autoDupe 开关是否有服务端读者 | open | 仍无读者；需产品决定 |
| 14 | crossseed | NO_QB/NO_SOURCE_HASH 是否记失败 | open | 早退不写 crossseed 状态 |
| 15 | scheduler-publish | 一个目标失败后是否继续其余目标 | risk | 当前 break，可能部分已传但不注入 |
| 16 | screen | 非数字未知分类是否放行 | risk | 仍放行；数字已拦 |
| 17 | screen | 规则/映射变化后 skipped 是否重审 | open | 仅类型变更会重置 |
| 18 | screen | dupeOf 指向条目删除后是否失效 | open | 指针可能悬空 |
| 19 | crawl | 详情失败次数是否无上限 | none | 有退避，上限 24h |
| 20 | crawl | fullDoneAt 是否在异常结束时误标 | none | 仅 endBy=end 标记 |
| 21 | crawl | catMap 同 id 多 label 是否丢类型 | none | 去重保留首个 label |
| 22 | crawl | selected cats 过滤后空集是否全抓 | none | 空集回退全分类，类型硬闸门仍在 |
| 23 | target-upload | 上传锁是否跨进程 | open | 进程内 Set，已知限制 |
| 24 | target-upload | 多目标部分失败是否误标完成 | none | allDone 要求全部 submitted/injected |
| 25 | target-upload | 关闭清洗时 passkey 是否拦 | none | announce 和 buffer 都扫 |
| 26 | target-upload | cleanAnnounce 手工覆盖是否限同站 | risk | 未校验 host，高级手工入口 |
| 27 | target-submit | 来源 URL 是否可带 cookie 出站 | none | sameSiteUrl 限制同站/子域 |
| 28 | target-plan | 数字 catId 是否直通目标站 | none | 已移除直通 |
| 29 | target-plan | 无映射是否静默猜分类 | none | type 空，提交前报错 |
| 30 | stage | submitted/injected 是否可回退 | none | 终态保护 |
| 31 | stage | status/stage 非法组合是否可查 | none | validate+audit-state，生产 0 条 |
| 32 | publish | failed from injected 是否允许重试 | none | 保留 stageFailedFrom |
| 33 | publish | published 条目是否重复注入 | none | isInjected 跳过 |
| 34 | release | prepare 是否清 failed 错误 | none | failed 保留错误/attempts |
| 35 | failure-queue | replay 后查重/补资料缓存是否清 | none | 清 dupe/meta/dedupe |
| 36 | failure-queue | replay 是否重置目标站结果 | none | 失败 target 回 pending |
| 37 | failure-queue | 死信判断是否把旧条目误判 | none | 有 nextRetryAt 时保留 |
| 38 | errors | 新错误码是否归 UNKNOWN | none | 已补抓取/上传/清洗码 |
| 39 | config | 默认值是否多处漂移 | none | config-schema.DEFAULTS 单一来源 |
| 40 | site-def | catMode 非法值是否保存 | none | 400 BAD_CAT_MODE |
| 41 | secretbox | v1 旧密文是否仍可解 | none | v1 兼容，v2 带 keyId |
| 42 | secretbox | 旧 key 轮换是否可用 | none | PTA_SECRET_PREVIOUS + rotate |
| 43 | site-pack | 站点包旧 key 是否可解 | none | SITE_PACK_KEY_PREVIOUS |
| 44 | qb | 5.x QBT_SID cookie 是否识别 | none | 正则兼容 QBT_SID_* |
| 45 | qb | 登录失败正文是否被当成功 | none | fails 检测 + status 检查 |
| 46 | qb | 下载器探测超时是否误报在线 | none | pass=200+version |
| 47 | routes-data | 凭据保存是否回明文 | none | 只回 hasCookie/readable |
| 48 | routes-target | 多目标失败是否逐个通知 | none | 已带 id/host/code |
| 49 | scheduler | 阶段异常是否拖垮整轮 | none | phaseError 隔离；SQLITE 才抛出 |
| 50 | ui | 多目标回查是否互相覆盖 | none | targetVerifyByHost + verifyOf |

结论：confirmed 12（已修），open/risk 7，其余 31 项读代码/跑检查未发现逻辑错误。
