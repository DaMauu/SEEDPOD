#!/usr/bin/env python3
"""离线 MediaInfo/BDInfo 文本解析：stdin JSON {text} → stdout JSON。
只做文本解析，不联网、不读数据库、不监听端口。"""
import json
import re
import sys


def norm_key(raw):
    key = re.sub(r"[^a-z0-9]+", "_", raw.strip().lower()).strip("_")
    return key or "field"


def parse_text(text):
    sections = []
    current = None
    for line in str(text or "").splitlines():
        line = line.rstrip()
        if not line.strip():
            continue
        m = re.match(r"^(General|Video|Audio|Text|Menu|Chapters)\b.*$", line.strip(), re.I)
        if m:
            current = {"type": m.group(1).lower(), "fields": {}}
            sections.append(current)
            continue
        if current is None:
            current = {"type": "general", "fields": {}}
            sections.append(current)
        kv = re.match(r"^\s*([^:]+?)\s*:\s*(.*)$", line)
        if not kv:
            continue
        key = norm_key(kv.group(1))
        val = kv.group(2).strip()
        if key in current["fields"]:
            current["fields"][key] = str(current["fields"][key]) + " / " + val
        else:
            current["fields"][key] = val

    tracks = {"general": [], "video": [], "audio": [], "text": []}
    other = []
    for sec in sections:
        if sec["type"] in tracks:
            tracks[sec["type"]].append(sec["fields"])
        else:
            other.append(sec)

    first = lambda t, k: (tracks[t][0].get(k, "") if tracks[t] else "")
    summary = {
        "video": len(tracks["video"]),
        "audio": len(tracks["audio"]),
        "text": len(tracks["text"]),
        "width": first("video", "width"),
        "height": first("video", "height"),
        "duration": first("general", "duration") or first("video", "duration"),
        "format": first("video", "format"),
        "audio_formats": [a.get("format", "") for a in tracks["audio"] if a.get("format")],
    }
    return {"ok": True, "tracks": tracks, "other": other, "summary": summary}


def main():
    try:
        raw = sys.stdin.read()
        if len(raw) > 512 * 1024:
            print(json.dumps({"ok": False, "error": "input too large"}, ensure_ascii=False))
            return 2
        payload = json.loads(raw or "{}")
        result = parse_text(payload.get("text", ""))
        if not result["tracks"]["general"] and not result["tracks"]["video"] and not result["tracks"]["audio"]:
            print(json.dumps({"ok": False, "error": "no mediainfo sections"}, ensure_ascii=False))
            return 1
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception as exc:  # noqa: BLE001 - CLI boundary
        print(json.dumps({"ok": False, "error": str(exc)[:200]}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    sys.exit(main())
