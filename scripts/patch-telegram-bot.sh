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

[ -f "$FILE" ] || { echo "找不到 $FILE"; exit 1; }
[ -f "$KB" ] || { echo "找不到 $KB"; exit 1; }

python3 - "$FILE" "$KB" <<'PY'
import io, sys
file, kb = sys.argv[1], sys.argv[2]

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
needle = '    keyboard.text(agentText).text(contextText).row();\n'
if needle in k:
    k = k.replace(needle, '', 1)
    io.open(kb, 'w', encoding='utf-8').write(k)
    print('已去掉 agent/上下文按钮')
else:
    print('键盘补丁已存在或版本不同')
PY

if [ "$RESTART" = "1" ]; then
  systemctl restart opencode-tg 2>/dev/null || sudo -n systemctl restart opencode-tg
  sleep 1
  systemctl is-active opencode-tg 2>/dev/null || true
fi
