# packages

「包」形态的脚本工程：源码拆在 `src/lib/`，用 esbuild 打包成 `dist/*.user.js`，带测试。

现在这里只有一份：`pt-bluray-assistant`（原盘转载面板的模块化开发线），内容来自 `collab` 分支的旧 `main` 快照。

```
src/main.js              入口
src/lib/*.js             batch / bdinfo / dupe / library / patterns / publish / shots / sites / subtitle / text
src/userscript.meta.js   油猴头部，构建时拼到产物最前面
dist/pt-bluray-assistant.user.js   已构建产物（直接可装）
test/*.test.js           node --test
build.mjs                esbuild 构建
```

用法：

```
cd scripts/packages
npm install      # 只装 esbuild
npm run build    # 生成 dist/pt-bluray-assistant.user.js
npm test
```

说明：

- 这份工程是历史开发线，功能已被 `scripts/bluray/` 里的单文件版覆盖并继续演进；保留它是为了源码结构与测试用例可查。
- 搬迁后 `build.mjs` 的 `root` 与 `package.json` 的脚本路径已改成相对本目录，`npm run build` 在本目录可直接跑通。
- 版本号沿用工程自己的 `package.json`，与单文件的 `0.0.0.N` 不同轨。
