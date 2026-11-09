[中文](#中文) · [English](#english)

---

## 中文

### 这个 PR 做了什么

<!-- 一句话说清动机，例如：修复 UNIT3D 站点填单时海报字段丢失 -->

### 影响范围

- [ ] scripts/bluray（新增版本文件，未改动旧版本）
- [ ] scripts/PTScripts（跟随上游，已先向上游提交）
- [ ] styles/r（已递增版本号并打 tag）
- [ ] pta
- [ ] 其他文档或配置

### 验证

- 站点类型与站点名：
- 浏览器 / Tampermonkey 版本：
- 实际结果：<!-- 装上新文件后跑通的那几条操作 -->

### 自查

- [ ] 单文件，无构建步骤、无新增依赖
- [ ] 旧版本文件未被覆盖或删除（bluray 为 `0.0.0.N` 新增）
- [ ] 头部 `@version`、面板标题、注入日志三处已同步
- [ ] 未提交 `.local` 站点数据、Cookie、passkey、密钥或个人信息
- [ ] 截图已脱敏

---

## English

### What does this PR do?

<!-- One sentence on the motivation, e.g. fix missing poster field when filling UNIT3D upload forms -->

### Scope

- [ ] scripts/bluray (new version file, old versions untouched)
- [ ] scripts/PTScripts (upstream change submitted first)
- [ ] styles/r (version bumped and tagged)
- [ ] pta
- [ ] Docs or config only

### Verification

- Tracker type and site:
- Browser / Tampermonkey version:
- Result: <!-- which flows you actually ran with the new file -->

### Checklist

- [ ] Single file, no build step, no new dependencies
- [ ] Old version files untouched (bluray adds `0.0.0.N`)
- [ ] `@version` header, panel title, and injection log line all updated
- [ ] No `.local` tracker data, cookies, passkeys, keys, or personal data committed
- [ ] Screenshots redacted
