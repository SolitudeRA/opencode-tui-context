# 贡献指南

[返回 README](README.zh-CN.md) · [English](CONTRIBUTING.md) · 简体中文 · [日本語](CONTRIBUTING.ja.md)

## 开发与验证

开发需要 Git、Bun 和 Node.js。宿主验证以 OpenCode V1 `1.18.31` 和 V2 `2.0.32` 为基线，SDK 版本固定在 `package.json` 中。克隆后运行：

```sh
bun install --frozen-lockfile
bun run typecheck
bun test
bun run test:render
npm run release:pack
```

`release:pack` 将 npm 包、ZIP 和校验文件写入 `release/`，不会发布。发布与宿主验收见[发布指南](docs/releasing.md)。

单元测试覆盖配置、用量计算、两套 API 的有效上下文选择、事件清理和响应式布局。`test:render` 构建三个产物，检查入口的按需加载，并在各自匹配的原生 OpenTUI 测试渲染器中运行两个适配器，使用模拟宿主 Context。这些检查不调用模型，也不启动 OpenCode，不能证明实际宿主加载或 npm 安装通过；需在两个宿主基线上分别验收，并区分测试数据与真实提供商用量。

## 源码结构

| 文件 | 职责 |
| --- | --- |
| [`tui.js`](tui.js) | 本地目录加载的根入口 |
| [`src/tui.tsx`](src/tui.tsx) | 通用入口，按需选择 V1 `tui` 或 V2 `setup` 适配器 |
| [`src/tui-v1.tsx`](src/tui-v1.tsx)、[`src/v1/plugin.tsx`](src/v1/plugin.tsx) | V1 模块、状态／事件、主题及 `sidebar_content` 注册 |
| [`src/tui-v2.tsx`](src/tui-v2.tsx)、[`src/plugin.tsx`](src/plugin.tsx) | V2 `Plugin.define()`、选项与 `sidebar.content` 注册 |
| [`src/panel.tsx`](src/panel.tsx) | 共享响应式布局与 V2 数据／主题适配 |
| [`src/usage.ts`](src/usage.ts)、[`src/v1/usage.ts`](src/v1/usage.ts) | 共享计算及宿主各自的消息／模型选择 |
| [`src/v1/refresh.ts`](src/v1/refresh.ts) | V1 事件订阅与卸载清理 |
| [`src/format.ts`](src/format.ts)、[`src/options.ts`](src/options.ts) | 字符格分配、紧凑数字与配置校验 |
| [`scripts/build.mjs`](scripts/build.mjs) | Solid JSX 编译与三个固定 ESM 产物 |
| [`scripts/test-entrypoints.mjs`](scripts/test-entrypoints.mjs) | 入口按需加载与依赖隔离检查 |
| [`scripts/test-render.mjs`](scripts/test-render.mjs)、[`scripts/test-render-v1.mjs`](scripts/test-render-v1.mjs) | 原生 V2／V1 渲染器契约检查 |
| [`scripts/release.mjs`](scripts/release.mjs) | 归档内容、导出路径与校验文件验证 |

通用入口不应包含 SDK 或渲染器的运行时导入，保证各宿主仅加载自己的适配器。V2 适配器使用 `@opencode/plugin/tui` 和 `Plugin.define()`；V1 适配器使用旧版模块契约。OpenCode 在运行时提供 SDK、OpenTUI 和 Solid。这些包仅放在 `devDependencies` 中：即使声明为可选 peer dependencies，也可能让 npm 同时解析两套宿主 SDK 和冲突的渲染器版本。发布包不声明运行时依赖或 peer dependencies，支持的宿主范围由 `engines.opencode` 记录。

本地安装必须保留 `package.json`、根目录 `tui.js`，以及 `dist/` 下的 `tui.js`、`tui-v1.js`、`tui-v2.js`。请保留 Solid JSX 转换：通用 JSX 转换可能编译成功，却破坏响应式渲染。

请保持改动聚焦，运行上述检查，并在 pull request 中说明用户可见的行为和验证结果。行为变化时更新相关测试，保持中英日 README、使用指南和贡献指南一致。较大的范围调整建议先通过 issue 讨论。
