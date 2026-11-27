#!/usr/bin/env bash
# 给全局安装的 opencode-telegram-bot 打本地补丁（升级后重跑）：
# 1) 引用回复：把被引用消息文字拼进 prompt
# 2) 回复键盘只保留一行两个按钮（模型/变体），去掉 agent 与上下文消耗
set -euo pipefail
RESTART=1
[ "${1:-}" = "--no-restart" ] && RESTART=0
BOT_DIR="${BOT_DIR:-/usr/lib/node_modules/@grinev/opencode-telegram-bot/dist/bot}"
FILE="$BOT_DIR/handlers/rich-message-handler.js"
KB="$BOT_DIR/keyboards/main-reply-keyboard.js"
STREAM="$BOT_DIR/streaming/compact-progress-streamer.js"

[ -f "$FILE" ] || { echo "找不到 $FILE"; exit 1; }
[ -f "$KB" ] || { echo "找不到 $KB"; exit 1; }
[ -f "$STREAM" ] || { echo "找不到 $STREAM"; exit 1; }

python3 - "$FILE" "$KB" "$STREAM" <<'PY'
import io, sys
file, kb, stream = sys.argv[1], sys.argv[2], sys.argv[3]

s = io.open(file, encoding='utf-8').read()
if '[引用]' not in s:
    old = """export function getIncomingPrompt(ctx) {
    const stored = ctx[incomingPromptKey];
    if (stored) {
        return stored;
    }
    const text = ctx.message?.text;
    return text === undefined ? null : createIncomingPrompt(text);
}"""
    new = """export function getIncomingPrompt(ctx) {
    const stored = ctx[incomingPromptKey];
    if (stored) {
        return stored;
    }
    const text = ctx.message?.text;
    if (text === undefined) {
        return null;
    }
    const quoted = ctx.message?.reply_to_message;
    const quotedText = String(quoted?.text || quoted?.caption || "").trim();
    const prefix = quotedText ? "[引用] " + quotedText.slice(0, 1200) + "\\n\\n[提问] " : "";
    return createIncomingPrompt(prefix + text);
}"""
    if old not in s:
        raise SystemExit('引用补丁：找不到匹配代码，版本可能变了')
    io.open(file, 'w', encoding='utf-8').write(s.replace(old, new, 1))
    print('已打引用补丁')
else:
    print('引用补丁已存在')

k = io.open(kb, encoding='utf-8').read()
changed = False
for needle in [
    '    keyboard.text(agentText).text(contextText).row();\n',
    '    keyboard.text(modelText).text(variantText).row();\n'
]:
    if needle in k:
        k = k.replace(needle, '', 1)
        changed = True
if changed:
    io.open(kb, 'w', encoding='utf-8').write(k)
    print('已去掉 agent/上下文/模型/变体按钮')
else:
    print('键盘按钮补丁已存在或版本不同')

k = io.open(kb, encoding='utf-8').read()
if '// no fixed buttons' not in k:
    old_ret = "    return keyboard.resized().persistent();\n}"
    new_ret = ("    // no fixed buttons: 没有排队/目标按钮时不显示键盘\n"
               "    if (queuedPromptLabels.length === 0 && goalLabels.length === 0) {\n"
               "        return removeKeyboard();\n"
               "    }\n"
               "    return keyboard.resized().persistent();\n}")
    if old_ret not in k:
        raise SystemExit('键盘兜底补丁：找不到返回语句，版本可能变了')
    io.open(kb, 'w', encoding='utf-8').write(k.replace(old_ret, new_ret, 1))
    print('已加空键盘兜底')
else:
    print('空键盘兜底已存在')

# 动态进度卡：把“工作中”改成当前进度百分比；读 ~/.config/opencode/live-progress.json，过期回退。
s2 = io.open(stream, encoding='utf-8').read()
if 'readLiveProgressPercent' not in s2:
    imp = 'import { resolveStreamThrottleMs, } from "./stream-throttle.js";\n'
    add = imp + 'import fs from "node:fs";\nimport path from "node:path";\n'
    if imp not in s2:
        raise SystemExit('进度补丁：找不到 import 位置')
    s2 = s2.replace(imp, add, 1)
    anchor = 'function createInitialState(sessionId) {'
    helper = '''function readLiveProgressPercent() {
    try {
        const file = process.env.TELEGRAM_PROGRESS_FILE || path.join(process.env.HOME || "", ".config/opencode/live-progress.json");
        const data = JSON.parse(fs.readFileSync(file, "utf8"));
        const pct = Number(data && data.percent);
        const updated = Number(data && data.updatedAt);
        const ttl = Number(data && data.ttlSec) || 900;
        if (!Number.isFinite(pct) || !Number.isFinite(updated)) return null;
        if (Date.now() - updated > ttl * 1000) return null;
        return Math.max(0, Math.min(100, Math.round(pct)));
    } catch (e) {
        return null;
    }
}
function progressHeader() {
    const pct = readLiveProgressPercent();
    return pct === null ? t("progress.compact.working_header") : `⏳ ${pct}%`;
}
'''
    if anchor not in s2:
        raise SystemExit('进度补丁：找不到插入位置')
    s2 = s2.replace(anchor, helper + anchor, 1)
    s2 = s2.replace('header: t("progress.compact.working_header"),', 'header: progressHeader(),')
    io.open(stream, 'w', encoding='utf-8').write(s2)
    print('已改进度卡：工作中 -> 百分比')
else:
    print('进度卡补丁已存在')
PY

if [ "$RESTART" = "1" ]; then
  systemctl restart opencode-tg 2>/dev/null || sudo -n systemctl restart opencode-tg
  sleep 1
  systemctl is-active opencode-tg 2>/dev/null || true
fi
