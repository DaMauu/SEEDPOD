# Python sidecar（可选）

只在 Python 明显更合适的离线任务上用。原则：

- 不监听端口、不连数据库、不做第二后端
- Node 通过 stdin JSON → stdout JSON 调用
- 任务白名单固定，默认超时 10 秒、输入 ≤512KB、输出 ≤2MB
- 只依赖 Python 标准库；新增依赖必须先说明

## 现有任务

| 任务 | 脚本 | 输入 | 输出 |
| --- | --- | --- | --- |
| `mediainfo` | `pta/sidecar/mediainfo.py` | `{"text":"MediaInfo/BDInfo 文本"}` | `{ok, tracks, summary}` |

## 用法

```bash
# Node 模块
const { run } = require('./pta/server/sidecar')
const r = await run('mediainfo', { text })

# CLI（JSON）
node pta/scripts/sidecar.js mediainfo --file mi.txt --json
cat mi.txt | node pta/scripts/sidecar.js mediainfo --json
```

检查：`node pta/checks/sidecar.js`（已进 `pta/checks/run.sh`）。
