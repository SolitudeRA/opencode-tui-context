# Contributing

[Back to README](README.md) · English · [简体中文](CONTRIBUTING.zh-CN.md) · [日本語](CONTRIBUTING.ja.md)

## Development

Use Git, Bun, and Node.js. Host validation targets OpenCode V1 `1.18.31` and V2 `2.0.32`; SDK versions are pinned in `package.json`. After cloning:

```sh
bun install --frozen-lockfile
bun run typecheck
bun test
bun run test:render
npm run release:pack
```

`release:pack` writes npm and ZIP archives plus checksums to `release/`; it does not publish. See the [release guide](docs/releasing.md) for publication and host acceptance.

Unit tests cover configuration, usage arithmetic, active-context selection in both APIs, event cleanup, and responsive layout. `test:render` builds all three bundles, verifies lazy entrypoint loading, and runs both adapters in their matching native OpenTUI test renderer with mocked host contexts. These checks make no model requests and do not launch OpenCode. They do not establish actual host loading or npm installation; validate those separately on both host baselines and distinguish synthetic fixtures from real-provider usage.

## Source layout

| File | Responsibility |
| --- | --- |
| [`tui.js`](tui.js) | Root entry for local directory loading |
| [`src/tui.tsx`](src/tui.tsx) | Universal entry; lazily selects the V1 `tui` or V2 `setup` adapter |
| [`src/tui-v1.tsx`](src/tui-v1.tsx), [`src/v1/plugin.tsx`](src/v1/plugin.tsx) | V1 module, state/events, theme, and `sidebar_content` registration |
| [`src/tui-v2.tsx`](src/tui-v2.tsx), [`src/plugin.tsx`](src/plugin.tsx) | V2 `Plugin.define()`, options, and `sidebar.content` registration |
| [`src/panel.tsx`](src/panel.tsx) | Shared responsive rendering and V2 data/theme adapter |
| [`src/usage.ts`](src/usage.ts), [`src/v1/usage.ts`](src/v1/usage.ts) | Common arithmetic and host-specific message/model selection |
| [`src/v1/refresh.ts`](src/v1/refresh.ts) | V1 event subscriptions and disposal |
| [`src/format.ts`](src/format.ts), [`src/options.ts`](src/options.ts) | Cell allocation, compact counts, and configuration validation |
| [`scripts/build.mjs`](scripts/build.mjs) | Solid JSX compilation and three fixed ESM bundles |
| [`scripts/test-entrypoints.mjs`](scripts/test-entrypoints.mjs) | Lazy entrypoint selection and dependency isolation |
| [`scripts/test-render.mjs`](scripts/test-render.mjs), [`scripts/test-render-v1.mjs`](scripts/test-render-v1.mjs) | Native V2/V1 renderer contract checks |
| [`scripts/release.mjs`](scripts/release.mjs) | Archive contents, export paths, and checksum validation |

Keep the universal entry free of runtime SDK or renderer imports: each host must load only its own adapter. The V2 adapter uses `@opencode/plugin/tui` and `Plugin.define()`; the V1 adapter uses the legacy module contract. OpenTUI and Solid remain external and are supplied by the host. Optional peers describe compatibility; no runtime `dependencies` or copied development dependencies are needed.

Local installations need `package.json`, the root `tui.js`, and all three files in `dist/`: `tui.js`, `tui-v1.js`, `tui-v2.js`. Keep the Solid JSX transform; a generic JSX transform can compile successfully while breaking reactive rendering.

Keep changes focused, run the checks above, and describe user-visible behavior and validation in your pull request. Update relevant tests when behavior changes and keep the English, Chinese, and Japanese READMEs, user guides, and contribution guides aligned. Discuss larger scope changes in an issue first.
