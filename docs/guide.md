# User guide

[Back to README](../README.md) · English · [简体中文](guide.zh-CN.md) · [日本語](guide.ja.md)

Installation alternatives, configuration, usage calculations, and troubleshooting for opencode-tui-context. For the recommended one-command installation, start with the [README](../README.md#quick-start).

[Installation](#quick-start) · [Reading the panel](#reading-the-panel) · [Configuration](#configuration) · [Usage calculations](#how-usage-is-calculated) · [Troubleshooting](#troubleshooting) · [Update or remove](#update-or-remove)

## Quick start

### Requirements

- **OpenCode `>=2.0.32 <3`** and plugin version `2.x`. The development SDK is pinned to `@opencode/plugin@2.0.32`; the declared range does not mean every host version has been tested. See [package.json](../package.json).
- V1 users should pin **`opencode-tui-context@1.0.1`** and follow the [V1 README](https://github.com/SolitudeRA/opencode-tui-context/blob/v1.0.1/README.md). The V2 bundle does not load in V1.
- Source installation needs **Git, [Bun](https://bun.sh/), and [Node.js](https://nodejs.org/)**. Published npm and ZIP packages do not need a local build.

### Install from npm

```sh
opencode plugin add opencode-tui-context@2.0.0
```

This installs the CLI-only package into the global `cli.json`. OpenCode V2 uses a single global CLI configuration; there is no project-local `cli.json`. See the host's [plugin commands](https://opencode.ai/v2/docs/cli/commands/#plugin) and [CLI settings](https://opencode.ai/v2/docs/cli/config/).

When migrating from V1, remove the old entry for this plugin from `tui.json`, then add the V2 entry to `cli.json`. Convert any `[package, options]` tuple to the [object form](#configuration). Keep unrelated settings and plugins. Avoid loading both a local copy and the npm package.

### Alternative: prebuilt ZIP

Releases include a prebuilt ZIP for installation when npm is unavailable:

1. Open [Releases](https://github.com/SolitudeRA/opencode-tui-context/releases) and download `opencode-tui-context-<version>.zip` from **Assets**. GitHub's **Source code** archives still require a build.
2. Extract the included `opencode-tui-context` directory into `local-plugins/` beside your `cli.json`. The default global location is `~/.config/opencode/local-plugins/` (`$HOME\.config\opencode\local-plugins\` on Windows). Keep `package.json`, the root `tui.js`, and `dist/tui.js` together.
3. Add the [local plugin entry](#enable-a-local-installation) below, then restart OpenCode.

### Install from source

Requires Git, Bun, and Node.js. Clone the repository and build `dist/tui.js`:

```sh
git clone https://github.com/SolitudeRA/opencode-tui-context.git
cd opencode-tui-context
bun install --frozen-lockfile
bun run build
```

The build produces `dist/tui.js`; the repository's root `tui.js` loads that bundle for local installations.

From the repository root, copy the build and manifest to the global plugin directory.

**macOS / Linux**

```sh
mkdir -p "$HOME/.config/opencode/local-plugins/opencode-tui-context"
cp -R dist package.json tui.js "$HOME/.config/opencode/local-plugins/opencode-tui-context/"
```

**Windows PowerShell**

```powershell
$pluginDir = Join-Path $HOME ".config/opencode/local-plugins/opencode-tui-context"
New-Item -ItemType Directory -Force -Path $pluginDir | Out-Null
Copy-Item -Path dist, package.json, tui.js -Destination $pluginDir -Recurse -Force
```

### Enable a local installation

Merge this entry into the global `cli.json`, keeping your other settings and plugins. The default location is `~/.config/opencode/cli.json` (`$HOME\.config\opencode\cli.json` on Windows); when set, `$XDG_CONFIG_HOME` replaces `~/.config`.

```json
{
  "plugins": ["./local-plugins/opencode-tui-context"]
}
```

Keep all three files below. Local directory loading needs the root `tui.js`; npm loading uses the manifest's `./tui` export. Both load the same `dist/tui.js` bundle. Source files and `node_modules` are not needed in the destination.

```text
local-plugins/opencode-tui-context/
├── package.json
├── tui.js
└── dist/
    └── tui.js
```

The path is relative to `cli.json`. For a custom config location, adjust the copy destination or use an absolute path. Windows JSON paths can use forward slashes, for example `D:/Codeing/opencode-tui-context`. Use a complete path instead of `~/...` in the plugin entry. See [CLI plugin configuration](https://opencode.ai/v2/docs/cli/plugins/).

### Show the panel

Restart OpenCode and open a session. Set `session.sidebar` to `"auto"` in `cli.json` and use a terminal wide enough for the sidebar. The **Context** panel appears at the end of `sidebar.content`, alongside the host's existing content. It does not replace other sidebar components.

The panel shows the latest assistant usage within the active context. Before that data is available, and immediately after a completed compaction with no newer assistant usage, it shows `no usage snapshot yet`. V1's `plugin_enabled` setting is not used in V2. See the host's [sidebar settings](https://opencode.ai/v2/docs/cli/config/#sessions).

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

Most colors follow the V2 host theme: interactive and accent hues, success and information text, muted text, and base text. Output uses fixed yellow (`#ffff00`), which may have lower contrast on light themes.

## Configuration

For npm installations, use the object form in `cli.json`. Keep the version suffix to stay on that release:

```json
{
  "plugins": [
    {
      "package": "opencode-tui-context@2.0.0",
      "options": {
        "barWidth": 24,
        "exclude": [],
        "showLegend": true
      }
    }
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

The plugin scans the active session context backwards for the newest assistant message with numeric `tokens.output > 0`. It ignores reverted messages and does not cross a completed compaction boundary. After compaction, the panel waits for a new assistant usage snapshot instead of displaying the previous context's usage or the compaction request's tokens. It looks up the limits for that message's `model.providerID` / `model.id`, even if you have since selected a different model.

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

The panel reacts to OpenCode V2's cached session, message, model, and theme data through Solid. Each mounted panel measures its own width; there is no polling or event throttle. The host removes the slot and its reactive computations when the plugin unloads. A new response may keep showing the previous eligible snapshot until it reports output tokens.

</details>

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Installation command is unavailable | Run `opencode --version` and `opencode plugin --help`. This version requires V2; keep plugin `1.0.1` if you still use V1. |
| No panel appears | Check the host version, the `cli.json` entry, and `session.sidebar: "auto"`. Widen the terminal. For local installations, check the `package.json` + root `tui.js` + `dist/tui.js` layout, then restart OpenCode. |
| `no usage snapshot yet` | No eligible assistant message has positive output tokens. Reverted messages and usage before a completed compaction are excluded. |
| Tokens appear but the overview is empty / `0% used` | A positive context limit is unavailable for the model that produced the measured message. Check its provider metadata. |
| Counts or percentage disappear in a narrow sidebar | The responsive layout hides details that do not fit. Widen the terminal/sidebar; `barWidth` does not override measured width. |
| Other context information is still visible | This plugin appends its panel to the existing sidebar. It does not disable host content or other plugins. |
| Values do not match a billing total or the next prompt | This is one reported assistant snapshot, not a cumulative bill or a tokenizer. |

Still having trouble? [Open an issue](https://github.com/SolitudeRA/opencode-tui-context/issues) with your OpenCode version, OS/terminal, plugin options, and a minimal reproduction. Include a redacted screenshot if the problem is visual.

## Update or remove

**npm:** run `opencode plugin check` to check available updates. To select a specific published V2 release, change only this plugin's `package` version in `cli.json`, preserving its options, and restart OpenCode. See `opencode plugin update --help` for the host's update command. V1 users should stay pinned to `1.0.1`.

**ZIP:** replace the installed directory with a newer V2 release, keeping the same path in `cli.json`. **Source:** update your unmodified checkout, then repeat the build and copy steps. Restart OpenCode.

To remove the npm entry from global configuration:

```sh
opencode plugin remove opencode-tui-context
```

Alternatively, remove this plugin's entry from the `plugins` array in `cli.json` and restart. For local installations, you may then delete the copied `local-plugins/opencode-tui-context` directory. Do not remove other plugin entries or the entire OpenCode configuration.
