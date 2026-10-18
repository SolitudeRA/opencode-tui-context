# 贡献指南

[返回 README](README.zh-CN.md) · [English](CONTRIBUTING.md) · 简体中文 · [日本語](CONTRIBUTING.ja.md)

## 开发与验证

开发需要 Git、Bun 和 Node.js；宿主验证使用 OpenCode `2.0.32`。V2 SDK 版本已固定在 `package.json` 中。克隆仓库后运行：

```sh
bun install --frozen-lockfile
bun run typecheck
bun test
bun run test:render
```

在本地生成 npm 包、预构建 ZIP 和校验文件：

```sh
npm run release:pack
```

产物位于 `release/`，此命令不会发布。首次 npm 设置、自动发布与宿主安装验收步骤见[发布指南](docs/releasing.md)。

单元测试覆盖选项、用量计算、有效上下文选择、条形格数分配、颜色、图例和窄宽度行为。`test:render` 会重新构建 `dist/tui.js`，在真实 OpenTUI 测试渲染器中运行产物，使用模拟的 V2 宿主 Context。九组场景覆盖空状态、token 响应式更新、消息模型查找、会话／位置切换、回退边界、压缩、缩放、主题变化和卸载清理；无网络请求，也不启动 OpenCode。

宿主验收仍需在 OpenCode 内重复这些场景。请记录具体宿主版本，并区分本地测试数据与真实提供商用量；渲染契约测试不能证明宿主插件加载或 npm 安装通过。

| 文件 | 职责 |
| --- | --- |
| [`tui.js`](tui.js) | 本地目录入口，加载构建产物 `dist/tui.js` |
| [`src/tui.tsx`](src/tui.tsx) | V2 `Plugin.define()` 入口与 ID（`opencode-tui-context`） |
| [`src/plugin.tsx`](src/plugin.tsx) | 配置读取、`sidebar.content` 插槽注册与清理 |
| [`src/panel.tsx`](src/panel.tsx) | 主题配色、模型查找与响应式渲染 |
| [`src/usage.ts`](src/usage.ts) | 消息选择与用量计算 |
| [`src/format.ts`](src/format.ts) | 紧凑数字格式与字符格分配 |
| [`src/options.ts`](src/options.ts) | 配置默认值与校验 |
| [`scripts/build.mjs`](scripts/build.mjs) | Babel 编译 Solid JSX，再由 esbuild 生成 ESM 构建产物 |
| [`scripts/test-render.mjs`](scripts/test-render.mjs) | 在原生 OpenTUI 测试渲染器中验证构建产物的九组场景 |
| [`scripts/release.mjs`](scripts/release.mjs) | 构建并验证 npm 包、预构建 ZIP 和 SHA-256 校验文件 |

构建产物将 `@opencode/plugin/tui`、OpenTUI 和 Solid 的导入保留为外部依赖，由 V2 宿主提供。清单声明了可选 peer dependencies，没有运行时 `dependencies`；安装目录无需复制开发依赖。本地安装须保留 `package.json`、根目录 `tui.js` 和 `dist/tui.js`；npm 使用清单的 `./tui` 导出。请保留 Solid JSX 转换流程：替换成通用 JSX 转换可能仍然编译成功，却破坏响应式渲染。

欢迎贡献。请让改动保持聚焦，运行上面的检查，并在 pull request 中说明用户可见的变化和验证结果。行为发生变化时，请更新相关测试，并保持中英日三版 README、[使用指南](docs/guide.zh-CN.md)和贡献指南一致。较大的范围调整建议先通过 issue 讨论。
