# opencode-tui-context

**See context usage and token composition at a glance in the OpenCode sidebar.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![OpenCode: >=1.18.0](https://img.shields.io/badge/OpenCode-%E2%89%A51.18.0-18181b)](#requirements)

English · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

Two compact bars show how much of your model's context window is used, how much is reserved for output, and how the reported tokens break down into cache, prompt, reasoning, and output.

![Illustrative context panel: 40 percent used, with used, reserved, and free capacity above a breakdown of cached, prompt, reasoning, and output tokens.](docs/assets/context-preview.svg)

*Illustration with sample counts; actual colors follow your OpenCode theme, except for the yellow output segment.*

- **Two views of the same snapshot:** window capacity above, used-token composition below.
- **Fits the sidebar:** bars resize automatically; legends stack or simplify as space narrows.
- **Updates with the session:** event-driven refresh without polling.
- **Configurable display:** hide individual segments or both legend groups.
- **Reads existing usage data:** no extra model calls, tokenizer, or credentials.

The panel reflects the **latest assistant message with output tokens**, not a cumulative session bill or an exact measurement of the next prompt.

[Quick start](#quick-start) · [Reading the panel](#reading-the-panel) · [Configuration](#configuration) · [Troubleshooting](#troubleshooting) · [Development](#development)

## Quick start

### Requirements

- **OpenCode `>=1.18.0`**, as declared in [package.json](package.json). The development SDK is pinned to `1.18.31`; this is not a guarantee that every later host version has been tested.
- The native installation commands below were checked against **OpenCode `1.18.31`**. On older versions, check `opencode plugin --help` or upgrade.
- npm and prebuilt ZIP installations require no local build. Only source installation needs **Git, [Bun](https://bun.sh/), and [Node.js](https://nodejs.org/)**.

### Install from npm (recommended after publication)

> **First npm release in preparation.** For now, use [the source installation](#install-from-source). The one-line command below becomes available after the package is published.

```sh
opencode plugin -g opencode-tui-context
```

OpenCode downloads the prebuilt package and adds it to the global `tui.json`. Restart OpenCode to load it. To install only for the current project, omit `-g`. You can also choose **Install plugin** in the command palette, enter `opencode-tui-context`, and select global scope. See the host's [installation guide](https://github.com/anomalyco/opencode/blob/v1.18.31/packages/opencode/specs/tui-plugins.md#package-manifest-and-install).

If migrating from a local installation, remove its old path entry from `tui.json` so the plugin is listed only once.

### Alternative: prebuilt ZIP

When a release includes prebuilt assets, use this route if npm is unavailable:

1. Open [Releases](https://github.com/SolitudeRA/opencode-tui-context/releases) and download `opencode-tui-context-<version>.zip` from **Assets**. GitHub's **Source code** archives still require a build.
2. Extract the included `opencode-tui-context` directory into `local-plugins/` beside your `tui.json`. The default global location is `~/.config/opencode/local-plugins/` (`$HOME\.config\opencode\local-plugins\` on Windows). Keep `package.json` and `dist/tui.js` together.
3. Add the [local plugin entry](#enable-a-local-installation) below, then restart OpenCode.

If the release has no prebuilt ZIP asset, use the source installation below.

### Install from source

<details>
<summary>Build and copy the plugin (currently available)</summary>

Requires Git, Bun, and Node.js. Clone the repository and build `dist/tui.js`:

```sh
git clone https://github.com/SolitudeRA/opencode-tui-context.git
cd opencode-tui-context
bun install --frozen-lockfile
bun run build
```

The build produces `dist/tui.js`.

From the repository root, copy the build and manifest to the global plugin directory.

**macOS / Linux**

```sh
mkdir -p "$HOME/.config/opencode/local-plugins/opencode-tui-context"
cp -R dist package.json "$HOME/.config/opencode/local-plugins/opencode-tui-context/"
```

**Windows PowerShell**

```powershell
$pluginDir = Join-Path $HOME ".config/opencode/local-plugins/opencode-tui-context"
New-Item -ItemType Directory -Force -Path $pluginDir | Out-Null
Copy-Item -Path dist, package.json -Destination $pluginDir -Recurse -Force
```

</details>

### Enable a local installation

For ZIP or source installations, merge this entry into `~/.config/opencode/tui.json` (`$HOME\.config\opencode\tui.json` on Windows), preserving your other settings and plugins:

```json
{
  "plugin": ["./local-plugins/opencode-tui-context"]
}
```

Keep this layout: the manifest's `./tui` export points to `dist/tui.js`. Source files and `node_modules` are not needed in the destination.

```text
local-plugins/opencode-tui-context/
├── package.json
└── dist/
    └── tui.js
```

The path is relative to the directory containing `tui.json`. If you use a custom config location, adjust the copy destination or use an absolute plugin path; Windows JSON paths can use forward slashes, such as `D:/Codeing/opencode-tui-context`. Avoid `~/...` inside the JSON plugin entry: the `1.18.31` loader does not expand it. See the host's [config path resolver](https://github.com/anomalyco/opencode/blob/v1.18.31/packages/opencode/src/config/plugin.ts#L38-L54) and [plugin path detection](https://github.com/anomalyco/opencode/blob/v1.18.31/packages/opencode/src/plugin/shared.ts#L158-L176).

### Show the panel

Use **`tui.json`**, rather than the server plugin list in `opencode.json`. Restart OpenCode, open a session, and show the sidebar. After an assistant message reports output tokens, the **Context** panel displays its usage; until then it shows `no assistant turns yet`.

To replace OpenCode's built-in context panel, also merge this setting:

```json
{
  "plugin_enabled": {
    "internal:sidebar-context": false
  }
}
```

If both panels remain visible, check the saved enable/disable state in OpenCode's plugin manager; it can override the config setting. Other sidebar plugins can remain enabled. See the host's [TUI plugin guide](https://github.com/anomalyco/opencode/blob/v1.18.31/packages/opencode/specs/tui-plugins.md) for enable-state precedence.

## Reading the panel

The **top bar** divides the model's context window into used, reserved, and free space. The **bottom bar** divides only the used tokens into four categories. Their denominators differ, so the lower bar can be full when the upper bar is mostly free.

| Bar | Legend | Segment | What it represents |
| --- | --- | --- | --- |
| Overview | `u` | `used` | Input + cache read + cache write + reasoning + output |
| Overview | `r` | `reserved` | Model output limit minus reported output, floored at zero |
| Overview | `f` | `free` | Context window minus used and reserved, floored at zero |
| Composition | `c` | `cached` | Cache-read tokens |
| Composition | `p` | `prompt` | Input + cache-write tokens |
| Composition | `t` | `think` | Reasoning tokens |
| Composition | `o` | `out` | Output tokens |

The title shows `used / window` as a rounded percentage. Legend counts use compact notation, such as `17.5K`. Solid `▓` cells show usage or reservation; `░` cells show the overview bar's remaining space.

When space is tight, each legend group moves its counts below the markers, then hides the counts, then hides the group. The title drops the percentage before hiding `Context`. Widening the sidebar restores the details.

Most colors come from the host theme: `used` → `primary`, `cached` → `success`, `prompt` → `accent`, `think` → `secondary`, `reserved` → `textMuted`, and `free` → `text`. Output uses fixed yellow (`#ffff00`), which may have lower contrast on light themes.

## Configuration

For npm installations, replace the package entry in `tui.json` with a `[package, options]` tuple. Keep an existing `@version` suffix if you want to stay on that version:

```json
{
  "plugin": [
    [
      "opencode-tui-context",
      {
        "barWidth": 24,
        "exclude": [],
        "showLegend": true
      }
    ]
  ]
}
```

For a ZIP or source installation, use `"./local-plugins/opencode-tui-context"` in place of the package name in this example. Edit the existing entry; do not add a second copy.

| Option | Type | Default | Behavior |
| --- | --- | --- | --- |
| `barWidth` | `number` | `24` | Initial **outer panel width** before measurement, rounded and clamped to `8–120`. The bars subtract four columns for borders and padding. Once measured, the panel follows the actual sidebar width. This does not set a fixed bar width. |
| `exclude` | `string[]` | `[]` | Hide any of `cached`, `prompt`, `think`, `out`, `reserved`, or `free` and their legend entries. `used` cannot be hidden. |
| `showLegend` | `boolean` | `true` | Show the two legend groups when space permits. `false` keeps the bars and title without legends. |

Invalid option types fall back to defaults; unknown or duplicate segment IDs are discarded. For a simpler panel, use `"showLegend": false`; to omit the free tail, use `"exclude": ["free"]`.

Exclusions do not change the used total or percentage, and visible composition segments are not rescaled to fill the bar. **If you hide `reserved` while keeping `free`, its cells become part of the visual free tail, but the free token count still subtracts the reservation.** Keep `reserved` visible when comparing that tail with its numeric count.

Restart OpenCode after changing the configuration or replacing the built plugin.

## How usage is calculated

The plugin scans the current session backwards for the newest assistant message with numeric `tokens.output > 0`. It reads that message's token fields and looks up the limits of its own `providerID` / `modelID`, even if you have since selected a different model.

```text
used     = input + cacheRead + cacheWrite + reasoning + output
prompt   = input + cacheWrite
window   = model.limit.context
reserved = max(0, model.limit.output - output)
free     = max(0, window - used - reserved)
percent  = min(100, round(used / window × 100))
```

Missing or invalid token counts become zero. The plugin sums these fields itself; it does not use `tokens.total`. If no positive output limit is available, `reserved` is zero. If no positive context limit is available, the overview bar is empty and `free` and the displayed percentage are zero; the composition can still show tokens. **In that case, `0% used` means the capacity is unknown, not that usage is empty.**

`reserved` is a display calculation from the model's output limit. It does not reserve tokens in OpenCode, predict the next response, or represent its auto-compaction threshold. Counts depend on the usage data reported by OpenCode and the provider; the plugin does not tokenize message text. It does not aggregate other turns, subagents, tools, or message roles, and it adds no commands or custom tools.

<details>
<summary>Bar rounding and refresh behavior</summary>

Each segment receives a rounded share of the available character cells, capped by the remaining width. A positive segment that rounds to zero receives a one-cell minimum when space can be taken from the remainder or a wider segment. The overview fills its remaining cells with `free` unless excluded; the composition leaves rounding gaps unfilled. Cell widths are therefore approximate, especially for tiny segments.

The plugin listens to `message.updated`, `message.part.updated`, `session.updated`, and `session.idle`. A 50 ms leading-edge throttle drops events inside that interval; there is no polling or trailing refresh timer. Subscriptions are removed when the plugin is disposed. A new response may keep showing the previous snapshot until it reports output tokens.

</details>

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Installation command is unavailable | Check `opencode plugin --help`; the native install flow is documented here for `1.18.31`. Upgrade OpenCode or use a local installation. |
| npm cannot find the package | The first npm release is still being prepared. Use source installation until publication; afterwards, check the requested version and registry access. |
| No panel appears | Check the OpenCode version, the visible sidebar, the `tui.json` entry, and the plugin manager's enable state. For local installations, also check the `package.json` + `dist/tui.js` layout. Restart OpenCode after changes. |
| `no assistant turns yet` | No assistant message has reported positive output tokens yet. An existing message with zero output does not qualify. |
| Tokens appear but the overview is empty / `0% used` | The plugin could not find a positive context limit for the model that produced the measured message. Check that model's provider metadata. |
| Counts or percentage disappear in a narrow sidebar | The responsive layout hides details that do not fit. Widen the terminal/sidebar; `barWidth` does not override the measured width. |
| Two context panels appear | Disable the built-in `internal:sidebar-context` panel or another plugin providing the same information. Check the plugin manager's saved state if `plugin_enabled` seems ineffective. |
| Values do not match a billing total or the next prompt | This is one reported assistant snapshot. It is not a sum across turns, a billing calculator, or a tokenizer. |

Still having trouble? [Open an issue](https://github.com/SolitudeRA/opencode-tui-context/issues) with your OpenCode version, OS/terminal, plugin options, and a minimal reproduction. Include a redacted screenshot if the problem is visual.

## Update or remove

**npm:** once published, replace `<version>` with a released version and run:

```sh
opencode plugin -g "opencode-tui-context@<version>" --force
```

Omit `-g` for a project installation. On OpenCode `1.18.31`, `--force` replaces the configured package version while preserving tuple options. An explicit version stays pinned; a bare package name follows `latest`. Restart OpenCode after updating. See the host's [update behavior](https://github.com/anomalyco/opencode/blob/v1.18.31/packages/opencode/specs/tui-plugins.md#package-manifest-and-install).

**ZIP:** download a newer prebuilt asset and replace the installed directory, keeping the same path in `tui.json`. **Source:** in an unmodified checkout, run `git pull --ff-only`, then repeat the build and copy steps. Restart OpenCode.

To stop loading the plugin, remove its entry from `tui.json`'s `plugin` array and restart. For local installations, you can then delete the copied `local-plugins/opencode-tui-context` directory. OpenCode `1.18.31` has no plugin uninstall command; removing the config entry does not clear its npm cache. If you disabled the built-in context panel, re-enable it through `plugin_enabled` or the plugin manager.

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

Contributions are welcome. Keep changes focused, run the checks above, and describe the user-visible behavior and validation in your pull request. For behavior changes, update the relevant tests and keep the [English](README.md), [Chinese](README.zh-CN.md), and [Japanese](README.ja.md) guides aligned. Discuss larger scope changes in an issue first.

## License

[MIT](LICENSE) © opencode-tui-context contributors.
