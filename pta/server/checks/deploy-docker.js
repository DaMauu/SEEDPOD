/* Docker/部署脚本的可验证契约：语法、镜像/卷/权限、compose 配置。
   不构建镜像、不联网、不启动容器。 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const REPO = path.resolve(ROOT, '..');
const results = [];
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

check('shell 脚本语法正确', function () {
  ['deploy.sh', 'docker-entrypoint.sh', 'pta/server/scripts/backup.sh', 'pta/server/scripts/restore.sh'].forEach(function (f) {
    const r = spawnSync('bash', ['-n', path.join(REPO, f)], { encoding: 'utf8' });
    need(r.status === 0, f + ' 语法失败：' + (r.stderr || ''));
  });
});

check('Dockerfile 多阶段、非 root、数据卷和健康检查', function () {
  const s = read('Dockerfile');
  need(/FROM node:22-alpine AS build/.test(s), '缺少构建阶段');
  need(/npm ci --omit=dev/.test(s), '运行阶段没装生产依赖');
  need(/COPY pta\/server/.test(s), '没复制 server');
  need(/COPY --from=build .*pta\/web\/dist/.test(s), '没复制构建产物');
  need(/VOLUME \["\/data"\]/.test(s), '缺少数据卷');
  need(/HEALTHCHECK/.test(s), '缺少健康检查');
  need(!/COPY .*\bdata\b/.test(s), '镜像不该复制 data');
});

check('compose 挂载 /data、限制本机端口、配置账号环境', function () {
  const s = read('docker-compose.yml');
  need(/\.\/data:\/data/.test(s), '没有挂载 data');
  need(/PTA_DATA: \/data/.test(s), '没有 PTA_DATA');
  need(/PTA_USER:/.test(s) && /PTA_PASS:/.test(s), '缺少面板账号环境');
  need(/127\.0\.0\.1.*8080/.test(s), '默认没限制本机端口');
  need(/restart: unless-stopped/.test(s), '缺少 restart 策略');
});

check('entrypoint 先修属主再降权', function () {
  const s = read('docker-entrypoint.sh');
  need(/chown -R pta:pta/.test(s), '没有修数据目录属主');
  need(/exec su-exec pta/.test(s), '没有降权运行');
  need(/id -u/.test(s), '没有判断 root');
});

check('deploy.sh 排除数据/日志、同步 scripts、构建并探活', function () {
  const s = read('deploy.sh');
  need(/--exclude "data\/"/.test(s), '没排除 data');
  need(/--exclude "\*\.log"/.test(s), '没排除日志');
  need(!/--exclude "scripts\/"/.test(s), 'scripts 不该被排除');
  need(/npm run build/.test(s), '没有构建前端');
  need(/systemctl restart/.test(s), '没有重启服务');
  need(/\/api\/health/.test(s), '没有健康检查');
});

check('docker compose config 可解析', function () {
  const r = spawnSync('docker', ['compose', '-f', path.join(REPO, 'docker-compose.yml'), 'config', '-q'], { encoding: 'utf8' });
  if (r.status === 127 || /not found/i.test(r.stderr || '')) return;
  need(r.status === 0, 'compose 配置失败：' + (r.stderr || r.stdout));
});

const pass = results.filter(function (r) { return r[0]; }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);
