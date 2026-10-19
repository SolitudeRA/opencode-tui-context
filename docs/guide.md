# User guide

[Back to README](../README.md) · English · [简体中文](guide.zh-CN.md) · [日本語](guide.ja.md)

Installation alternatives, configuration, usage calculations, and troubleshooting for opencode-tui-context. For the recommended one-command installation, start with the [README](../README.md#quick-start).

[Installation](#quick-start) · [Reading the panel](#reading-the-panel) · [Configuration](#configuration) · [Usage calculations](#how-usage-is-calculated) · [Troubleshooting](#troubleshooting) · [Update or remove](#update-or-remove)

## Quick start

### Requirements

- **OpenCode V1 `>=1.18.31 <2` or V2 `>=2.0.32 <3`**. Package `2.1.1` includes both adapters and selects the host API automatically. Validation baselines are V1 `1.18.31` and V2 `2.0.32`; the declared range does not mean every version has been tested. See [package.json](../package.json).
- Source installation needs **Git, [Bun](https://bun.sh/), and [Node.js](https://nodejs.org/)**. npm and ZIP packages do not need a local build.
- V1 users can upgrade to `2.1.1`. If an older installation must be retained, `1.0.1` and its [tagged guide](https://github.com/SolitudeRA/opencode-tui-context/blob/v1.0.1/README.md) remain a fallback.

### Install from npm

Check `opencode --version` and run the matching command:

| Host | Command | Writes to |
| --- | --- | --- |
| V1 | `opencode plugin -g opencode-tui-context@2.1.1` | Global `tui.json`, `plugin` array |
| V2 | `opencode plugin add opencode-tui-context@2.1.1` | Global `cli.json`, `plugins` array |

V1 also supports project installation by omitting `-g`; see the [V1 plugin specification](https://github.com/anomalyco/opencode/blob/v1.18.31/packages/opencode/specs/tui-plugins.md#package-manifest-and-install). V2 uses a single global CLI configuration; see [V2 plugin commands](https://opencode.ai/v2/docs/cli/commands/#plugin).

When upgrading OpenCode from V1 to V2, move this plugin's entry from `tui.json` to `cli.json` and convert its tuple to the [object form](#configuration). Keep unrelated settings and plugins. Use only one npm or local entry for this plugin.

### Alternative: prebuilt ZIP

Releases include a prebuilt ZIP for installation when npm is unavailable:

1. Open [Releases](https://github.com/SolitudeRA/opencode-tui-context/releases) and download `opencode-tui-context-<version>.zip` from **Assets**. GitHub's **Source code** archives still require a build.
2. Extract the included `opencode-tui-context` directory into `local-plugins/` beside your `tui.json` (V1) or `cli.json` (V2). The default global location is `~/.config/opencode/local-plugins/` (`$HOME\.config\opencode\local-plugins\` on Windows). Keep `package.json`, the root `tui.js`, and the complete `dist/` directory together.
3. Add the [local plugin entry](#enable-a-local-installation) below, then restart OpenCode.

### Install from source

Requires Git, Bun, and Node.js. Clone the repository and build the package:

```sh
git clone https://github.com/SolitudeRA/opencode-tui-context.git
cd opencode-tui-context
bun install --frozen-lockfile
bun run build
```

The build produces `dist/tui.js`, `dist/tui-v1.js`, and `dist/tui-v2.js`; the root `tui.js` provides the local entry.

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

Keep the package beside the appropriate configuration file: V1 uses `tui.json`, V2 uses `cli.json`. The default global directory is `~/.config/opencode/` (`$HOME\.config\opencode\` on Windows); `$XDG_CONFIG_HOME`, when set, replaces `~/.config`.

**V1 — `tui.json`**

```json
{
  "plugin": ["./local-plugins/opencode-tui-context"]
}
```

**V2 — `cli.json`**

```json
{
  "plugins": ["./local-plugins/opencode-tui-context"]
}
```

Keep all five files below. The root entry and npm `./tui` export lead to `dist/tui.js`, which lazily loads the matching adapter. Do not copy only one adapter. Source files and `node_modules` are not needed in the destination.

```text
local-plugins/opencode-tui-context/
├── package.json
├── tui.js
└── dist/
    ├── tui.js
    ├── tui-v1.js
    └── tui-v2.js
```

The plugin path is relative to the configuration file containing the entry. Adjust the copy destination for a custom configuration, or use an absolute path. Windows JSON accepts forward slashes, for example `D:/Codeing/opencode-tui-context`. Use a complete path instead of `~/...`.

### Show the panel

Restart OpenCode, open a session, and show the sidebar. The **Context** panel appends to the existing sidebar and shows `no usage snapshot yet` until eligible assistant usage is available.

- **V1:** enable `opencode-tui-context` in the plugin manager. To hide the built-in context panel, set `plugin_enabled["internal:sidebar-context"]` to `false` in `tui.json`. Saved plugin-manager state can override this setting; see [enable-state precedence](https://github.com/anomalyco/opencode/blob/v1.18.31/packages/opencode/specs/tui-plugins.md#tui-config).
- **V2:** set `session.sidebar` to `"auto"` in `cli.json` and use a wide enough terminal. V2 does not use V1's `plugin_enabled`; see [sidebar settings](https://opencode.ai/v2/docs/cli/config/#sessions).

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

Most colors follow the host theme through the matching adapter. Output uses fixed yellow (`#ffff00`), which may have lower contrast on light themes.

## Configuration

Both adapters accept the same options. Edit the existing entry in the configuration for your host, preserving the version suffix and unrelated settings.

**V1 — `tui.json`**

```json
{
  "plugin": [
    ["opencode-tui-context@2.1.1", {
      "barWidth": 24,
      "exclude": [],
      "showLegend": true
    }]
  ]
}
```

**V2 — `cli.json`**

```json
{
  "plugins": [
    {
      "package": "opencode-tui-context@2.1.1",
      "options": {
        "barWidth": 24,
        "exclude": [],
        "showLegend": true
      }
    }
  ]
}
```

For ZIP or source installations, replace the package name with `"./local-plugins/opencode-tui-context"` in the appropriate example. Do not add a second copy.

| Option | Type | Default | Behavior |
| --- | --- | --- | --- |
| `barWidth` | `number` | `24` | Initial **outer panel width** before measurement, rounded and clamped to `8–120`. The bars subtract four columns for borders and padding. Once measured, the panel follows the actual sidebar width. This does not set a fixed bar width. |
| `exclude` | `string[]` | `[]` | Hide any of `cached`, `prompt`, `think`, `out`, `reserved`, or `free` and their legend entries. `used` cannot be hidden. |
| `showLegend` | `boolean` | `true` | Show the two legend groups when space permits. `false` keeps the bars and title without legends. |

Invalid option types fall back to defaults; unknown or duplicate segment IDs are discarded. For a simpler panel, use `"showLegend": false`; to omit the free tail, use `"exclude": ["free"]`.

Exclusions do not change the used total or percentage, and visible composition segments are not rescaled to fill the bar. **If you hide `reserved` while keeping `free`, its cells become part of the visual free tail, but the free token count still subtracts the reservation.** Keep `reserved` visible when comparing that tail with its numeric count.

Restart OpenCode after changing the configuration or replacing the built plugin.

## How usage is calculated

The plugin scans the active session context backwards for the newest assistant message with numeric `tokens.output > 0`. It ignores reverted messages and does not cross a completed compaction boundary. After compaction, the panel waits for a new assistant usage snapshot instead of displaying the previous context's usage or the compaction request's tokens. It looks up the limits for that message's model identity (`providerID` / `modelID` in V1, `model.providerID` / `model.id` in V2), even if you have since selected a different model.

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

V2 reads reactive host caches through Solid. V1 refreshes from its host state and events. Each mounted panel measures its own width, and unloading releases its slot and subscriptions. Neither adapter polls. A new response may keep showing the previous eligible snapshot until it reports output tokens.

</details>

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Installation command is unavailable | Run `opencode --version` and `opencode plugin --help`. Choose the V1 or V2 command above for your host version. |
| No panel appears | Check the matching configuration (`tui.json` in V1, `cli.json` in V2), plugin enable state, and visible sidebar. For local installations, keep the root entry and all three `dist/` files, then restart OpenCode. |
| `no usage snapshot yet` | No eligible assistant message has positive output tokens. Reverted messages and usage before a completed compaction are excluded. |
| Tokens appear but the overview is empty / `0% used` | A positive context limit is unavailable for the model that produced the measured message. Check its provider metadata. |
| Counts or percentage disappear in a narrow sidebar | The responsive layout hides details that do not fit. Widen the terminal/sidebar; `barWidth` does not override measured width. |
| Other context information is still visible | This plugin appends its panel to the existing sidebar. It does not disable host content or other plugins. |
| Values do not match a billing total or the next prompt | This is one reported assistant snapshot, not a cumulative bill or a tokenizer. |

Still having trouble? [Open an issue](https://github.com/SolitudeRA/opencode-tui-context/issues) with your OpenCode version, OS/terminal, plugin options, and a minimal reproduction. Include a redacted screenshot if the problem is visual.

## Update or remove

**V1 npm:** to upgrade an existing entry while preserving tuple options, run:

```sh
opencode plugin -g opencode-tui-context@2.1.1 --force
```

**V2 npm:** run `opencode plugin check` to check available updates. To select a published version, change only this plugin's `package` version in `cli.json`, preserving its options. See `opencode plugin update --help` for the host's update command.

**ZIP:** replace the complete installed directory, keeping its configured path. **Source:** update your unmodified checkout, then repeat the build and copy steps. Restart OpenCode.

To remove the plugin, delete its entry from V1's `tui.json` → `plugin` or V2's `cli.json` → `plugins`, then restart. V2 also provides `opencode plugin remove opencode-tui-context`; V1 `1.18.31` has no uninstall command. You may then delete the copied local plugin directory. Keep other plugins and configuration; on V1, re-enable the built-in context panel if you previously disabled it.
