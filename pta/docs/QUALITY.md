# 质量审计（固定检查）

脚本：`pta/scripts/audit-quality.js`
入口：`pta/checks/run.sh` 的「质量审计」段，每次检查都会跑。
定位：给开发指路，不替代 smoke / api-v2 / target 等功能检查。

## 七个维度

| 维度 | 看什么 |
| --- | --- |
| 代码 | 文件规模、TODO/FIXME、console.log、空 catch |
| 功能 | 页面/接口数量、检查覆盖、流程规则完成度、前后端接口缺口 |
| 编写 | 必备文档、版本号同步、检查入口完整度 |
| 逻辑 | 前端调用与后端路由匹配、规则读者、import 可解析 |
| 简洁度 | 最大代码文件、CSS 重复选择器 |
| 复用率 | 共享组件/样式、重复函数名 |
| 质量 | 检查数量、文档、接口/import 缺口 |

SFC 的行数按“不含 `<style>`”计算，scoped 样式单独看；CSS 的 scoped 迁移不会把代码分直接打穿。

## 七档评级（D → SSS）

| 分数 | 评级 | 含义 |
| --- | --- | --- |
| ≥ 97 | SSS | 最高级，可以直接进 |
| 93–96 | SS | 很稳 |
| 88–92 | S | 可交付 |
| 80–87 | A | 有明确改进点 |
| 70–79 | B | 能跑，建议先还债 |
| 60–69 | C | 风险偏高，不要继续加复杂度 |
| < 60 | D | 最差，停手先修；不允许带 D 提交 |

## 四种范围

```bash
# 整个 PTA
node pta/scripts/audit-quality.js --project pta

# 单文件
node pta/scripts/audit-quality.js --file pta/server/crawl.js

# 单功能（dashboard/sites/crawl/queue/sources/logs/settings/target/publish/...）
node pta/scripts/audit-quality.js --feature sites

# 单项目（pta / bluray / ptscripts / repo）
node pta/scripts/audit-quality.js --project bluray

# JSON 输出，给 CI/脚本用
node pta/scripts/audit-quality.js --project pta --json
```

## 基线防回退

全库审计有 `pta/quality-baseline.json`。`--fail` 的规则：

- 有基线时：任一维度比基线低 2 分以上，或总体低 2 分以上，退出 1；
- 没有基线时：任一维度 D 或总体 D，退出 1；
- `--strict`：任一维度 C/D 就退出 1（给冲刺阶段用）。

改完确认分数是**真实提升**后再更新基线：

```bash
node pta/scripts/audit-quality.js --project pta --update-baseline
```

不要为了过闸门删检查、删文档或改阈值；分数只是信号，问题清单才是要修的东西。

## 当前基线（0.7.150）

- 代码 78 / 功能 86 / 编写 100 / 逻辑 76 / 简洁 80 / 复用 70 / 质量 99
- 总体 83（A，旧标尺曾是「平衡」）
- 主要待还：`Sites.vue` 代码 1181 行、40 条未接规则、11 个重复函数、46 个空 catch、117 个重复 CSS 选择器

## 每轮怎么用

1. 改完一个页面/功能，先跑 `--feature <name>`；
2. 有 D 先修；有 C 记录到 HANDOFF；
3. 全量 `run.sh` 跑基线闸门；
4. 只在新版本确实提升时更新基线，并在 CHANGELOG 写清原因。
