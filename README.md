English | [简体中文](README.zh-CN.md) | [日本語](README.ja.md)

# opencode-tui-context

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

In OpenCode's TUI sidebar, this plugin draws the current session's context-window usage as two segmented bars: an overview bar showing `used` / `reserved` / `free`, and a composition bar showing `cached` / `prompt` / `think` / `out`. It registers the host-provided `sidebar_content` slot, reads the token counts and model limits of the session's last assistant message, computes each segment's share and renders them. The plugin id is `opencode-tui-context`.

## Features

- Renders two configurable-width bars in the sidebar, one above the other: the overview bar uses `window` as its denominator and splits into `used` / `reserved` / `free`; the composition bar uses `used` as its denominator and splits into `cached` / `prompt` / `think` / `out`.
- Each bar has its own row of letter legend beneath it: `u` / `r` / `f` for the overview bar, `c` / `p` / `t` / `o` for the composition bar. Each entry is a single-cell swatch styled like the bar, with one space between the swatch and the letter and one space between the letter and that segment's compact count.
- Shows the percentage used in the panel's top-right corner; the token totals live on the overview legend row (the three numbers for `u` / `r` / `f`) instead of on a line of their own.
- Refreshes automatically when the session gets a new message: it subscribes to `message.updated`, `message.part.updated`, `session.updated` and `session.idle`, throttles repaints with a 50ms leading edge, and clears every subscription on unmount without ever polling on a timer.
- Shows `no assistant turns yet` before there is any assistant message, so the panel is neither blank nor an error.

## Scope

The project is deliberately minimal. These things are explicitly out of scope: the panel does no per-tool token ranking, no token trend chart, does not break down or display subagent usage, ships no built-in tokenizer (tiktoken, for instance), registers no custom tools, offers no `/context` command, and does no SYSTEM/USER/ASSISTANT role attribution. It reflects exactly one snapshot: the last assistant message that carries output tokens.

## Display

The bars' segments and their colours are listed below.

| Bar | segment id | Meaning | Colour token |
| --- | --- | --- | --- |
| Overview | `used` | input + cacheRead + cacheWrite + reasoning + output | `primary` |
| Overview | `reserved` | the amount reserved by `limit.output - output` | `textMuted` |
| Overview | `free` | remaining window | `text` |
| Composition | `cached` | cached input tokens (cache read) | `success` |
| Composition | `prompt` | input + cacheWrite | `accent` |
| Composition | `think` | reasoning | `secondary` |
| Composition | `out` | output | `#ffff00` (hardcoded) |

Except for `out`, a colour token is a field name in the host theme, resolved from `api.theme.current.<token>`; `out` uses the hardcoded `#ffff00`.

`think` uses `secondary`, a blue at a hue of about 215 degrees and at least about 46 degrees of hue away from every other colour in the panel. `out` uses the hardcoded `#ffff00`, pure yellow at a hue of about 60 degrees, and the reason it is hardcoded is that the default opencode theme has no bright yellow. The theme's own yellows all sit too close: `warning` (`#f5a742`, hue about 34 degrees) and `markdownEmph` (`#e5c07b`, hue about 39 degrees) are only 10 to 15 degrees of hue from the `primary` (hue about 24 degrees) used by the `used` segment, so two adjacent swatches are nearly indistinguishable, the exact collision this panel has to avoid; and the lemon-green `diffHighlightAdded` (`#b8db87`, hue about 85 degrees) leans green rather than yellow. Hardcoding has a cost as well: `#ffff00` does not follow the host theme, so it looks out of place under a light theme. The panel has five colours in total (`u` / `c` / `p` / `t` / `o`), chosen to maximise the smallest hue distance between any two of them.

The panel's outermost element is a border coloured `borderSubtle`, with one column of padding on each side. Inside, top to bottom, come the title row, the overview bar, the composition bar, the first legend row and the second legend row. The title row is split with `space-between`: `Context` on the left, the usage percentage (like `42% used`) on the right.

Both bars span the full row and are drawn with block characters: each segment repeats its character for the cells it receives and colours it with the segment colour. The overview bar uses `window` as its denominator; `used` and `reserved` are solid `▓` (U+2593), `free` is hollow `░` (U+2591); the unused remainder is all appended as a trailing `free` segment, so the three segments' cells sum to exactly the bar width (unless `free` is excluded). The composition bar uses `used` as its denominator; `cached`, `prompt`, `think` and `out` are all solid `▓`, and no `free` tail is appended on purpose, so the four segments may sum to 0 to 2 cells less than the bar width, leaving that small gap at the bar's right end.

The two legend rows appear only when `showLegend` is `true`. The first row matches the overview bar, in the order `u` / `r` / `f`; the second matches the composition bar, in the order `c` / `p` / `t` / `o`. Each entry has three parts, with one space between adjacent parts: a single-cell swatch styled like the bar, solid `▓` (U+2593) for non-`free` segments and hollow `░` (U+2591) for `free`; then a lowercase letter; then that segment's compact count (like `17.4K`). The letter takes the segment's colour and the count always uses `textMuted`.

A segment hidden by `exclude` disappears from both its bar and its legend entry, letter and count included. The percentage in the top-right corner uses the same colour as the overview bar's `used` segment (`primary`) and does not change colour with the usage level. Both bars take their total column count from the panel's measured width and adapt to the actual available width: when the panel widens both bars lengthen together, and when the sidebar narrows both bars shorten together, without wrapping; the top-right percentage stays fixed and is unaffected by the bar width.

## Install

Prerequisite: `opencode` must be available, at a version that satisfies the "Compatibility" section. The plugin is built from source and loaded as a local directory; it does not go through any package manager.

```
git clone https://github.com/owner/opencode-tui-context.git
cd opencode-tui-context
bun install
bun run build
mkdir -p ~/.config/opencode/local-plugins/opencode-tui-context
cp -r dist package.json ~/.config/opencode/local-plugins/opencode-tui-context/
```

The last step copies only `dist/` and `package.json`; the local approach has no use for the source or the development dependencies, so there's no need to put them in the target directory.

Next, add the target directory to the `plugin` array in `~/.config/opencode/tui.json`:

```json
{
  "plugin": ["~/.config/opencode/local-plugins/opencode-tui-context"]
}
```

`tui.json` is read only once when opencode starts and is not hot-reloaded, so `opencode` has to be restarted before the change takes effect.

If the maintainer attaches a built `tui.js` to a GitHub Release, you can download it into the target directory and skip both the `bun install` and `bun run build` steps.

The `owner` in the commands is a placeholder for a GitHub account. It has to be replaced with the real account before a public release, in `package.json` and in all three READMEs.

## Configuration

Options go in the second element of the `plugin` array tuple, in the form `["<spec>", { ... }]`, where `<spec>` is the local directory path.

```json
{
  "plugin": [
    [
      "~/.config/opencode/local-plugins/opencode-tui-context",
      { "barWidth": 40, "exclude": ["free"], "showLegend": true }
    ]
  ]
}
```

| Option | Default | Rules and fallback |
| --- | --- | --- |
| `barWidth` | `24` | The initial bar width (in characters) before the panel's measured width is available. It is rounded first, then clamped to `8-120`. A non-number or non-finite value (`NaN`, `±Infinity`) falls back to `24`; `0` is clamped to `8`, `999` to `120`. After the first frame the bar width comes from the panel's measured width and follows it automatically; `barWidth` only covers the time before a measurement exists. |
| `exclude` | `[]` | A list of segment ids to hide from both bars and their legend entries. It accepts only the six values `cached`, `prompt`, `think`, `out`, `reserved`, `free`; invalid values are dropped, and duplicates are de-duplicated keeping the order of first appearance. A non-array falls back to `[]`. |
| `showLegend` | `true` | Whether to show the two letter legend rows. A non-boolean falls back to `true`. When set to `false`, only the two legend rows are hidden; both bars and the top-right percentage stay. |

Every option is normalized. A missing config, `null`, a wrong type, or even an options object that is not an object at all never throws: they all fall back to the defaults in the table above.

## Computation

Let `input`, `cacheRead`, `cacheWrite`, `reasoning` and `output` be the token counts of the measured message, and `limit.context` and `limit.output` the context and output limits of the model that message used. The quantities are defined as follows:

```
used     = input + cacheRead + cacheWrite + reasoning + output
window   = limit.context
reserved = max(0, limit.output - output)
free     = max(0, window - used - reserved)
prompt   = input + cacheWrite
percent  = min(100, round(used / window * 100))
```

A few notes:

- The measured object is the newest assistant message in the session that carries `tokens.output > 0`. Scanning the message list backwards from the end, the first message that satisfies both `role === "assistant"` and `tokens.output > 0` is the data source.
- When `window` is `0` (the model's limit cannot be obtained), both `free` and `percent` are `0`, the overview bar is left entirely empty because it has no denominator, and the composition bar and both legend rows render as usual.
- `reserved` is computed only when `limit.output > 0`; otherwise it is `0`.
- The overview bar's `used` and `reserved` are allocated by `round(segment tokens / window * barWidth)`, and the unused remainder is all appended as a trailing `free` segment (unless `free` is in `exclude`), so the three segments sum to exactly the bar width.
- The composition bar's `cached`, `prompt`, `think` and `out` are allocated by `round(segment tokens / used * barWidth)`, and no `free` tail is appended on purpose, so the four segments may sum to 0 to 2 cells less than the bar width.
- A visual floor applies to both bars: a segment with `token > 0` that rounds to less than `1` cell is topped up to `1` cell so it never silently disappears from the bar and the legend. The floor is paid from the unallocated remainder first; if there is not enough, it borrows one cell from the currently widest segment; if neither can spare a cell, that segment stays hidden.
- Only segments whose token count is `> 0` enter a bar. Both legend rows list every segment that is not excluded, so a segment with no tokens still appears there with a count of `0`.

## Compatibility

- The measured `opencode` version: `1.18.31`; `package.json`'s engines requirement for it is `>=1.18.0`.
- The `@opentui/solid` version this project resolved in practice: `0.4.5`; `package.json`'s peer requirement for it is `>=0.4.5`.
- The host rewrites this plugin's imports of `@opentui/solid` and `solid-js` to its own bundled modules. In other words, the plugin's `devDependencies` versions only affect the shape of the build output, not runtime module resolution; at runtime the host's own copy is used.
- The plugin has no runtime dependencies (its `dependencies` is empty); its output references only host-provided modules and Node built-ins.

## Coexistence with other plugins

`sidebar_content` is a shared slot provided by the host, and multiple plugins can register content into the same slot at the same time. This plugin registers that slot at `order: 60`. The `order` value is defined in the plugin's implementation, not in `tui.json`.

If another plugin also writes a context panel into `sidebar_content`, enabling both at once puts two overlapping panels in the sidebar. Keep just one of them: remove the one you don't need from the `plugin` array in `tui.json`.

The host's built-in context panel registers the same slot. If you don't want it to overlap this plugin, set `"internal:sidebar-context"` to `false` in `tui.json`'s `plugin_enabled`. This plugin has no entry in `plugin_enabled`, so it stays enabled.

## Disable and uninstall

To disable it temporarily and keep the files for re-enabling later: open `~/.config/opencode/tui.json` and remove the `~/.config/opencode/local-plugins/opencode-tui-context` entry from the `plugin` array. If you want the host's built-in context panel back, set `"internal:sidebar-context"` to `true` in `plugin_enabled`.

To uninstall completely: first disable it as above, then delete the local directory:

```
rm -rf ~/.config/opencode/local-plugins/opencode-tui-context
```

When editing `tui.json`, it's best to front it with a backup and record the hash:

```
B=/tmp/tui.json.before-$(date +%s%N)
cp ~/.config/opencode/tui.json "$B"
sha256sum "$B"
```

To restore, copy the backup back and verify the hash matches the backup:

```
cp /tmp/tui.json.before-<timestamp> ~/.config/opencode/tui.json
sha256sum ~/.config/opencode/tui.json
```

`tui.json` is read only once when opencode starts and is not hot-reloaded, so `opencode` has to be restarted before the change takes effect.

## License

Released under the MIT License; see [LICENSE](LICENSE) for the full terms.
