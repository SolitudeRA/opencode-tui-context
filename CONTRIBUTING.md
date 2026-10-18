# Contributing

[Back to README](README.md) · English · [简体中文](CONTRIBUTING.zh-CN.md) · [日本語](CONTRIBUTING.ja.md)

## Development

Use Git, Bun, and Node.js for development, plus OpenCode `2.0.32` for host verification. The V2 SDK is pinned in `package.json`. After cloning the repository:

```sh
bun install --frozen-lockfile
bun run typecheck
bun test
bun run test:render
```

To prepare the npm tarball, prebuilt ZIP, and checksums locally:

```sh
npm run release:pack
```

Artifacts are written to `release/`; this command does not publish them. See the [release guide](docs/releasing.md) for the initial npm setup, automated publication, and host installation checks.

Unit tests cover options, usage arithmetic, active-context selection, bar allocation, colors, legends, and narrow widths. `test:render` rebuilds `dist/tui.js` and runs it in the real OpenTUI test renderer against a mocked V2 host context. Its nine scenario groups cover empty state, reactive token updates, message-model lookup, session/location switching, revert boundaries, compaction, resizing, theme changes, and cleanup. It uses no network requests and does not launch OpenCode.

For host acceptance, repeat those scenarios inside OpenCode. Record the exact host version and distinguish local fixtures from real provider usage; renderer contract tests do not verify the host's plugin loader or npm installation.

| File | Responsibility |
| --- | --- |
| [`tui.js`](tui.js) | Local-directory entry that loads the built `dist/tui.js` bundle |
| [`src/tui.tsx`](src/tui.tsx) | V2 `Plugin.define()` entry and ID (`opencode-tui-context`) |
| [`src/plugin.tsx`](src/plugin.tsx) | Options and `sidebar.content` slot registration and cleanup |
| [`src/panel.tsx`](src/panel.tsx) | Theme colors, model lookup, and responsive rendering |
| [`src/usage.ts`](src/usage.ts) | Message selection and usage calculation |
| [`src/format.ts`](src/format.ts) | Compact counts and character-cell allocation |
| [`src/options.ts`](src/options.ts) | Configuration defaults and validation |
| [`scripts/build.mjs`](scripts/build.mjs) | Solid JSX compilation with Babel, followed by ESM bundling with esbuild |
| [`scripts/test-render.mjs`](scripts/test-render.mjs) | Nine scenario groups against the built bundle in OpenTUI's native test renderer |
| [`scripts/release.mjs`](scripts/release.mjs) | Build and validate the npm tarball, prebuilt ZIP, and SHA-256 checksums |

The bundle leaves `@opencode/plugin/tui`, OpenTUI, and Solid imports external for the V2 host to provide. The manifest declares optional peer dependencies and no runtime `dependencies`; copying development dependencies into the installed plugin is unnecessary. Local copies need `package.json`, the root `tui.js`, and `dist/tui.js`; npm uses the manifest's `./tui` export. Keep the Solid JSX transform: replacing it with a generic JSX transform can compile successfully while breaking reactive rendering.

Contributions are welcome. Keep changes focused, run the checks above, and describe the user-visible behavior and validation in your pull request. For behavior changes, update the relevant tests and keep the English, Chinese, and Japanese READMEs, [user guides](docs/guide.md), and contribution guides aligned. Discuss larger scope changes in an issue first.
