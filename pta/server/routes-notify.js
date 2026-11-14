/* 通知配置与测试。token 只写不读：环境变量优先，或面板加密存 DB。 */
const secretbox = require('./secretbox');

module.exports = function (app, ctx) {
  const { one, db, ok, bad, DATA_DIR } = ctx;
  const KEYRING = secretbox.loadKey(DATA_DIR);
  const notify = ctx.notify;
  const now = () => new Date().toISOString();

  function readCfg() {
    const row = one("SELECT v FROM meta WHERE k = 'config'");
    return JSON.parse(row ? row.v : 'null') || {};
  }
  function saveCfg(next) {
    db.prepare("INSERT INTO meta(k, v) VALUES('config', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")
      .run(JSON.stringify(next));
  }

  app.get('/api/notify', async () => ok(notify.status()));

  app.put('/api/notify', async (req, reply) => {
    const b = req.body || {};
    const cfg = readCfg();
    if (b.events !== undefined) {
      const e = String(b.events);
      if (['off', 'error', 'always'].indexOf(e) < 0) return bad(reply, 'BAD_REQUEST', 'events 只能是 off / error / always');
      cfg.notifyEvents = e;
    }
    if (b.webhook !== undefined) {
      const u = String(b.webhook || '').trim();
      if (u && !/^https?:\/\//i.test(u)) return bad(reply, 'BAD_WEBHOOK', 'webhook 必须是 http/https');
      cfg.notifyWebhook = u.slice(0, 500);
    }
    if (b.clearTelegram) {
      delete cfg.notifyTgToken;
      delete cfg.notifyTgChat;
    } else {
      if (b.telegramToken !== undefined) {
        const tok = String(b.telegramToken || '').trim();
        if (tok) cfg.notifyTgToken = secretbox.encrypt(tok.slice(0, 200), KEYRING.key);
      }
      if (b.telegramChat !== undefined) {
        const chat = String(b.telegramChat || '').trim();
        if (chat && !/^-?\d{3,25}$/.test(chat)) return bad(reply, 'BAD_CHAT', 'chat id 只能是数字（可带负号）');
        cfg.notifyTgChat = chat.slice(0, 40);
      }
    }
    cfg.notifyUpdatedAt = now();
    saveCfg(cfg);
    return ok(reply, notify.status());
  });

  app.post('/api/notify/test', async (req, reply) => {
    const r = await notify.send('test', 'SEEDPOD 通知测试 · ' + now(), {}, { force: true });
    if (r.skipped) return bad(reply, 'NO_CHANNEL', '通知通道未配置：服务器环境变量缺 Telegram token/chat', 409);
    if (!r.ok) return bad(reply, 'NOTIFY_FAILED', r.error || '发送失败', 502);
    return ok(reply, { channel: r.channel, status: r.status });
  });
};
