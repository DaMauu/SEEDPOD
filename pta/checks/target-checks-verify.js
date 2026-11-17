/* target 删除/回查检查组：删除 dry-run/真删、回收站、回查判定。 */
async function runDeleteVerify(C) {
  const { check, need, json, BASE, torrent, hits, state, mockPort, qid } = C;
  await check('删除测试种：dry-run、真删与回查', async function () {
    const dry = await json(BASE + '/api/targets/127.0.0.1/delete', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '42' })
    });
    need(dry.status === 200 && dry.body.ok, '删除 dry-run 失败：' + dry.status);
    need(dry.body.data.reasonType === '0' && dry.body.data.reasonField === 'reason_input', '删除表单没解析对：' + JSON.stringify(dry.body.data));
    need(dry.body.data.sent === false && state.deleteHits === 0, 'dry-run 不该发删除请求');
    const real = await json(BASE + '/api/targets/127.0.0.1/delete', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '42', dryRun: false, reason: '测试', reasonType: '其他' })
    });
    need(real.status === 200 && real.body.ok && real.body.data.deleted === true, '真删没确认：' + real.status + ' ' + JSON.stringify(real.body));
    need(state.deleteHits === 1 && state.deleteBody, '删除请求没发出');
    need(state.deleteBody.id === '42' && state.deleteBody.reason_type === '0' && state.deleteBody.reason_input === '测试' && state.deleteBody.type === 'torrent', '删除表单字段不对：' + JSON.stringify(state.deleteBody));
    const chk = await json(BASE + '/api/targets/127.0.0.1/delete', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '42', check: true })
    });
    need(chk.status === 200 && chk.body.ok && chk.body.data.deleted === true, '删除状态回查不对：' + JSON.stringify(chk.body));
    state.mockDeleted = false; state.deleteHits = 0; state.deleteBody = null;
  });

  await check('删除表单兼容 reasontype + reason[]', async function () {
    const dry = await json(BASE + '/api/targets/127.0.0.1/delete', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '43', reason: '测试', reasonType: '其他' })
    });
    need(dry.status === 200 && dry.body.ok, '第二种删除 dry-run 失败：' + dry.status);
    need(dry.body.data.reasonType === '5' && dry.body.data.reasonField === 'reason[]', '第二种删除表单没解析对：' + JSON.stringify(dry.body.data));
    const real = await json(BASE + '/api/targets/127.0.0.1/delete', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '43', dryRun: false, reason: '测试', reasonType: '其他' })
    });
    need(real.status === 200 && real.body.ok && real.body.data.deleted === true, '第二种真删没确认：' + real.status + ' ' + JSON.stringify(real.body));
    need(JSON.stringify(state.deleteBodyReasons) === JSON.stringify(['', '', '', '测试']), 'reason[] 索引不对：' + JSON.stringify(state.deleteBodyReasons));
    const chk = await json(BASE + '/api/targets/127.0.0.1/delete', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '43', check: true })
    });
    need(chk.status === 200 && chk.body.ok && chk.body.data.deleted === true, '没有该ID的种子应判为已删：' + JSON.stringify(chk.body));
    state.mockDeleted = false; state.deletedId = ''; state.deleteHits = 0; state.deleteBody = null; state.deleteBodyReasons = [];
  });

  await check('回收站同 infohash 不重复发布', async function () {
    state.mockDeleted = true; state.deletedId = '42';
    try {
      const add = await json(BASE + '/api/queue', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Target Upload Test 2024 1080p Blu-ray', targetSite: '127.0.0.1', status: 'approved', cat: 'movie', res: '1080p', size: '20 GB',
          shots: ['shot-1.jpg', 'shot-2.jpg', 'shot-3.jpg'] })
      });
      need(add.status === 200 && add.body.ok, '建回收站测试队列失败');
      const id = add.body.data.id;
      const v = await json(BASE + '/api/targets/127.0.0.1/verify', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ queueId: id, torrentBase64: torrent.toString('base64'), url: 'http://127.0.0.1:' + mockPort + '/details.php?id=42' })
      });
      need(v.status === 200 && v.body.ok && v.body.data.deleted === true && v.body.data.found === false, '回收站详情没标记成已删除：' + JSON.stringify(v.body));
      const before = hits.length;
      const up = await json(BASE + '/api/targets/127.0.0.1/upload', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ queueId: id, torrentBase64: torrent.toString('base64'), dryRun: false, verify: true })
      });
      need(up.status === 200 && up.body && up.body.error && up.body.error.code === 'TARGET_EXISTS', '回收站同 hash 没跳过：' + up.status + ' ' + JSON.stringify(up.body));
      need(hits.length === before + 1, '回收站检查应只发 1 次上传，实际 ' + (hits.length - before) + ' 次');
      await json(BASE + '/api/queue/' + encodeURIComponent(id), { method: 'DELETE' });
    } finally {
      state.mockDeleted = false; state.deletedId = '';
    }
  });

  await check('回查不把搜索框回显当命中', async function () {
    const add = await json(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Echo Only 2024 1080p', targetSite: '127.0.0.1', status: 'pending', cat: 'movie' })
    });
    need(add.status === 200 && add.body.ok, '创建回查条目失败');
    const v = await json(BASE + '/api/targets/127.0.0.1/verify', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queueId: add.body.data.id, torrentBase64: torrent.toString('base64') })
    });
    need(v.status === 200 && v.body.ok, '回查失败：' + v.status);
    need(v.body.data.found === false, '搜索框回显被误判为命中');
    need(v.body.data.rows === 0, '搜索结果行数不是 0');
  });

  await check('关闭发布后校验时跳过回查', async function () {
    const put = await json(BASE + '/api/flow', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sets: { pub: [[{ t: '发布后校验', on: false }, { t: 'BDInfo', on: false }, { t: '截图至少几张', on: false }]] } })
    });
    need(put.status === 200 && put.body.ok, '关发布后校验失败');
    const add = await json(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Verify Off Test 2024 1080p', targetSite: '127.0.0.1', status: 'approved', cat: 'movie', res: '1080p', size: '20 GB',
        shots: ['shot-1.jpg', 'shot-2.jpg', 'shot-3.jpg'] })
    });
    need(add.status === 200 && add.body.ok, '建回查关闭队列失败');
    const id = add.body.data.id;
    const before = hits.length;
    const up = await json(BASE + '/api/targets/127.0.0.1/upload', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queueId: id, torrentBase64: torrent.toString('base64'), dryRun: false })
    });
    need(up.status === 200 && up.body.ok, '关闭回查后提交失败：' + JSON.stringify(up.body && up.body.error));
    need(up.body.data.sent === true && up.body.data.verify === null, '关闭回查后还在回查');
    need(hits.length === before + 1, '关闭回查后上传次数不对');
    const on = await json(BASE + '/api/flow', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sets: { pub: [[{ t: '发布后校验', on: true }, { t: 'BDInfo', on: false }, { t: '截图至少几张', on: false }]] } })
    });
    need(on.status === 200 && on.body.ok, '恢复发布后校验失败');
    const del = await json(BASE + '/api/queue/' + encodeURIComponent(id), { method: 'DELETE' });
    need(del.status === 200 && del.body.ok, '清理回查关闭队列失败');
  });

  await check('回查接口', async function () {
    const v = await json(BASE + '/api/targets/127.0.0.1/verify', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queueId: qid, torrentBase64: torrent.toString('base64'), url: 'http://127.0.0.1:' + mockPort + '/details.php?id=42' })
    });
    need(v.status === 200 && v.body.ok && v.body.data.found === true, '回查失败：' + JSON.stringify(v.body));
  });
}

module.exports = { runDeleteVerify };
