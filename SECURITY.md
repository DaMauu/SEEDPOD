# 安全策略 / Security Policy

[中文](#中文) · [English](#english)

---

## 中文

### 报告漏洞

请**不要**通过公开 Issue 报告安全问题。用仓库的私密渠道：

1. 打开 [Security](../../security/advisories) 标签页，点「Report a vulnerability」；
2. 或直接联系维护者，说明复现步骤与影响范围。

我们会在 7 天内首次回复，确认后再协商修复与公开时间。

### 需要报告什么

种荚的脚本运行在已登录的私有站点页面上，能读到页面内容并代你发请求。以下都算安全问题：

- 脚本把 Cookie、passkey、Tracker 密钥、站点账号密码发送到第三方地址
- 引入未经说明的外部请求（统计、图床、CDN 之外的域名）
- 可以把恶意内容注入面板或弹窗的 XSS 路径
- 跨站查重、填单、推送下载器环节的越权或参数注入
- 样式表通过外部 `@import` 加载不可信资源

### 不在范围内

- 站点自身的漏洞（请报告给对应站点）
- 站点规则、种子内容、账号封禁等运营问题
- 需要先拿到你本机文件或浏览器扩展权限才能利用的问题

### 提交 Issue / PR 时

贴日志和截图前请删掉：Cookie、passkey、Tracker 密钥、下载器地址与口令、站点用户名。控制台报错保留堆栈即可，不要整段复制请求头。

---

## English

### Reporting a vulnerability

Please **do not** report security issues through public Issues. Use the repository's private channel:

1. Open the [Security](../../security/advisories) tab and click "Report a vulnerability";
2. Or contact the maintainer directly with reproduction steps and impact.

We aim to respond within 7 days, and will agree on fix and disclosure timing with you.

### What to report

SEEDPOD's userscripts run on logged-in private tracker pages, can read page content, and can issue requests on your behalf. These all count as security issues:

- Credentials (cookies, passkeys, tracker keys, account passwords) sent to a third-party address
- Undocumented outbound requests (to domains other than the image host, CDN, or services the docs describe)
- XSS paths that inject attacker-controlled content into the panel or dialogs
- Privilege or parameter injection in cross-site dedupe, upload form filling, or downloader push
- Stylesheets loading untrusted resources via external `@import`

### Out of scope

- Vulnerabilities in the trackers themselves (report those to the site)
- Site rules, torrent content, or account bans
- Issues that require prior access to your local files or browser extension context

### When filing an Issue or PR

Before posting logs or screenshots, remove: cookies, passkeys, tracker keys, downloader addresses and passwords, and site usernames. Keep the stack trace; do not paste whole request headers.
