# Contributing

[Back to README](README.md) · English · [简体中文](CONTRIBUTING.zh-CN.md) · [日本語](CONTRIBUTING.ja.md)

## Development

Use Git, Bun, and Node.js for development. After cloning the repository:

```sh
bun install --frozen-lockfile
bun run typecheck
bun test
bun run build
```

To prepare the npm tarball, prebuilt ZIP, and checksums locally:

```sh
npm run release:pack
```

Artifacts are written to `release/`; this command does not publish them. See the [release guide](docs/releasing.md) for the initial npm setup, automated publication, and host installation checks.

Tests cover option normalization, usage arithmetic, bar allocation, colors, legends, and narrow-width behavior. They do not replace a smoke test inside OpenCode: after UI changes, check an empty session, a response with token data, a narrow sidebar, and plugin coexistence.

| File | Responsibility |
| --- | --- |
| [`src/tui.tsx`](src/tui.tsx) | Plugin module and ID (`opencode-tui-context`) |
| [`src/plugin.tsx`](src/plugin.tsx) | Event subscriptions and `sidebar_content` registration at order `60` |
| [`src/panel.tsx`](src/panel.tsx) | Theme colors, model lookup, and responsive rendering |
| [`src/usage.ts`](src/usage.ts) | Message selection and usage calculation |
| [`src/format.ts`](src/format.ts) | Compact counts and character-cell allocation |
| [`src/options.ts`](src/options.ts) | Configuration defaults and validation |
| [`scripts/build.mjs`](scripts/build.mjs) | ESM bundle generation with esbuild |
| [`scripts/release.mjs`](scripts/release.mjs) | Build and validate the npm tarball, prebuilt ZIP, and SHA-256 checksums |

The bundle leaves OpenTUI and Solid imports external for the host to provide. The manifest declares optional peer dependencies and no runtime `dependencies`; copying development dependencies into the installed plugin is unnecessary.

Contributions are welcome. Keep changes focused, run the checks above, and describe the user-visible behavior and validation in your pull request. For behavior changes, update the relevant tests and keep the English, Chinese, and Japanese READMEs, [user guides](docs/guide.md), and contribution guides aligned. Discuss larger scope changes in an issue first.
