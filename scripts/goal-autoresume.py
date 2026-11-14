#!/usr/bin/env python3
"""OpenCode goal 自动续跑：只处理“达到轮次上限”导致的暂停。

- 每 3 分钟由 systemd timer 调用一次
- 目标完成、用户手动暂停、无目标时都不动
- 关闭：touch /home/ocbot/.config/opencode/goal-autoresume.off
"""
import base64
import json
import os
import sys
import urllib.error
import urllib.request

ENV_FILE = os.environ.get("OPENCODE_TG_ENV_FILE", "")
OFF_FILE = os.environ.get("OPENCODE_GOAL_OFF_FILE") or os.path.join(os.path.expanduser("~"), ".config/opencode/goal-autoresume.off")
LIMIT_PREFIX = "Reached the limit of"


def load_env():
    env = dict(os.environ)
    if not ENV_FILE:
        return env
    try:
        with open(ENV_FILE, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    except OSError as e:
        print("cannot read env: " + str(e))
    return env


def request(api, password, path, payload=None):
    url = api.rstrip("/") + path
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, method="POST" if data else "GET")
    req.add_header("authorization", "Basic " + base64.b64encode(("opencode:" + password).encode()).decode())
    if data:
        req.add_header("content-type", "application/json")
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.status, resp.read()


def main():
    if os.path.exists(OFF_FILE):
        print("disabled by " + OFF_FILE)
        return
    env = load_env()
    api = env.get("OPENCODE_API_URL", "http://127.0.0.1:49374")
    password = env.get("OPENCODE_SERVER_PASSWORD", "")
    if not password:
        print("no OPENCODE_SERVER_PASSWORD")
        return

    try:
        _, raw = request(api, password, "/api/session/active")
        active = json.loads(raw).get("data") or {}
        sid = next(iter(active), None)
        if not sid:
            print("no active session")
            return

        _, raw = request(api, password, "/api/rpc/opencode.goal/get", {"input": {"sessionID": sid}})
        goal = json.loads(raw).get("output")
        if not goal:
            print("no goal")
            return
        status = goal.get("status")
        reason = str(goal.get("reason") or "")
        rounds = goal.get("rounds")
        max_rounds = goal.get("maxRounds")
        if status != "paused":
            print("goal %s %s/%s, nothing to do" % (status, rounds, max_rounds))
            return
        if not reason.startswith(LIMIT_PREFIX):
            print("paused for another reason, skip: " + reason)
            return

        code, _ = request(api, password, "/api/session/%s/command" % sid,
                          {"name": "goal", "text": "resume", "delivery": "queue"})
        print("resumed %s after %s/%s rounds (http %s)" % (sid, rounds, max_rounds, code))
    except urllib.error.HTTPError as e:
        print("http %s: %s" % (e.code, e.read()[:200]))
    except Exception as e:
        print("error: " + str(e))


if __name__ == "__main__":
    main()
    sys.exit(0)
