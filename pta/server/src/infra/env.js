/* 环境变量读取：新名字优先，旧 PTA_ 前缀做兼容兜底。
   新名字不带项目名，直接写功能和单位，例如 SEARCH_WAIT_SEC。 */
function read(name, legacy) {
  if (process.env[name] !== undefined && process.env[name] !== '') return process.env[name];
  if (legacy && process.env[legacy] !== undefined && process.env[legacy] !== '') return process.env[legacy];
  return undefined;
}

module.exports = { read: read };
