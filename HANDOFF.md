# HANDOFF · SEEDPOD 面板

最后更新：2026-11-10

## 现在是什么状态

前端 7 个页面 + 登录页，全部交互可点（142 个交互点无死按钮）。
后端是本机 Node 零依赖服务，已实现：会话登录、配置读写、站点清单、事件日志、SSE、静态托管。

线上：源码直跑在测试机 `/opt/seedpod`，systemd 服务 `seedpod`，nginx 反代 + Cloudflare，入口是 pta 开头的那个域名。
开机自启已配；改完代码 `systemctl restart seedpod` 生效。

## 后端接口（已实现）

| 接口 | 说明 |
| --- | --- |
| GET /api/health | 探活，不需要登录 |
| POST /api/login | 账号密码换 HttpOnly 会话 cookie（12h） |
| GET /api/session | 当前是否已登录 |
| POST /api/logout | 注销 |
| GET /api/config | 系统硬底线 + 用户配置 + 双模式区间 |
| PATCH /api/config/user | 改速率，越界 400 |
| GET /api/sites | 305 个站点（host/url/arch）与架构统计 |
| GET /api/logs | 最近事件 |
| GET /api/logs/stream | SSE，断线按 id 补历史 |

事件会写进 `data/events.log`：服务启动、登录成功/失败、退出、改配置。

## 检查

```
pta\checks\run.cmd
```

- smoke.js 18 条：登录、七页渲染、分类映射、越界拦截、上传/查重、导出下载、确认弹窗、无 JS 错
- audit.js：逐个点所有可点元素，报死按钮
- api.js 11 条：健康、配置区间、落盘、站点清单结构、登录与 401

改完必须全绿再提交。

## 下一步

1. 前端站点页改成从 `/api/sites` 取数（现在仍读 assets/sites-data.local.js）
2. 站点详情「抓取测试」改成服务端真探测（需要一个不带账号的 GET，注意别被站点当异常请求）
3. 站点配置从 localStorage 迁到服务端持久化
4. 之后才碰抓取执行器与 qB 连接

## 注意

- 真实站点清单只在本机与测试机：`pta/web/assets/sites-data.local.js`、`pta/data/site-arch.local.csv`，都已被 gitignore，不要提交
- 面板账号密码不入库，只配在测试机 systemd 环境变量里
- Cloudflare 会缓存 js/css，静态资源已加 no-cache 与版本号；换版本记得改 `?v=` 参数
