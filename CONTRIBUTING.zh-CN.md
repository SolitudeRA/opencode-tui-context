# 贡献指南

[返回 README](README.zh-CN.md) · [English](CONTRIBUTING.md) · 简体中文 · [日本語](CONTRIBUTING.ja.md)

## 开发与验证

开发需要 Git、Bun 和 Node.js。克隆仓库后运行：

```sh
bun install --frozen-lockfile
bun run typecheck
bun test
bun run build
```

在本地生成 npm 包、预构建 ZIP 和校验文件：

```sh
npm run release:pack
```

产物位于 `release/`，此命令不会发布。首次 npm 设置、自动发布与宿主安装验收步骤见[发布指南](docs/releasing.md)。

测试覆盖配置归一化、用量计算、条形格数分配、颜色、图例和窄宽度行为。它们不能替代 OpenCode 内的冒烟测试：修改 UI 后，请检查空会话、有 token 数据的回复、窄侧栏及与其他插件共存的情况。

| 文件 | 职责 |
| --- | --- |
| [`src/tui.tsx`](src/tui.tsx) | 插件模块与 ID（`opencode-tui-context`） |
| [`src/plugin.tsx`](src/plugin.tsx) | 事件订阅，以顺序值 `60` 注册 `sidebar_content` |
| [`src/panel.tsx`](src/panel.tsx) | 主题配色、模型查找与响应式渲染 |
| [`src/usage.ts`](src/usage.ts) | 消息选择与用量计算 |
| [`src/format.ts`](src/format.ts) | 紧凑数字格式与字符格分配 |
| [`src/options.ts`](src/options.ts) | 配置默认值与校验 |
| [`scripts/build.mjs`](scripts/build.mjs) | 使用 esbuild 生成 ESM 构建产物 |
| [`scripts/release.mjs`](scripts/release.mjs) | 构建并验证 npm 包、预构建 ZIP 和 SHA-256 校验文件 |

构建产物将 OpenTUI 和 Solid 的导入保留为外部依赖，由宿主提供。清单声明了可选 peer dependencies，没有运行时 `dependencies`；安装目录无需复制开发依赖。

欢迎贡献。请让改动保持聚焦，运行上面的检查，并在 pull request 中说明用户可见的变化和验证结果。行为发生变化时，请更新相关测试，并保持中英日三版 README、[使用指南](docs/guide.zh-CN.md)和贡献指南一致。较大的范围调整建议先通过 issue 讨论。
