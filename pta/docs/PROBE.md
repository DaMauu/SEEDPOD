# 目标站上传表单探测

最后更新：2026-11-19

## 状态

- 探测暂停，等更多站点 cookie 补齐。
- 真实上传/回查/删除已经验 3 个站；删除测试暂停。
- 报告位置：私有 `data/site-probe.json`（含站名/字段，0600，不入库）。

## 命令

```bash
pta probe [--all] [--limit 20] [--delay 1200] [--hosts h1,h2] [--write] [--json]
```

- 默认只扫有 cookie 的目标站。
- 每站只 GET 一次上传页，不提交、不下载、不删除。
- `--write` 把报告写到 `data/site-probe.json`。

## 首批结果

- 有 cookie 的目标站 10 个。
- 8 个上传表单可用，2 个 `NO_FORM`。
- 1 个站文件字段与配置不一致，已修正为实际字段。
- 分类 `type` / `category_id` 选项可以自动解析；分类用途映射仍需人工确认。

## 已知问题

1. `NO_FORM`：上传页可能是登录页、Cloudflare 页、JS 渲染或自定义表单，需要单独看。
2. 探测只比较关键字段（name / small_descr / descr / type / category_id）和文件字段，不判断站点是否还有额外必填项。
3. 文件字段差异目前只报告，尚未自动写回私有站点定义；已手动修 1 个。
4. 删除表单差异只按引擎默认处理；不同表单暂不逐站验，遇到再记例外。
5. 真实提交仍需少量授权站样本，不能只靠表单探测。

## 下一步

1. 查 `NO_FORM` 站点：cookie、登录页、Cloudflare、JS 渲染或自定义表单。
2. 给 `probe` 加安全的 `--apply`：只自动写 `fileField/path/formPath`，分类映射人工确认。
3. cookie 补齐后继续批量探测；删除测试等上传字段稳定后再统一验。
