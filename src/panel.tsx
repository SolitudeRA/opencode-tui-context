/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import { RGBA, type BoxRenderable } from "@opentui/core"
import { createSignal } from "solid-js"
import { formatCompact, formatCompositionBar, formatOverviewBar, formatPercent } from "./format"
import type { OverviewSegmentId, PluginOptions_, SegmentId, Usage, UsageLimits } from "./types"
import { computeUsage, lastAssistantWithTokens, type AssistantUsage } from "./usage"

export const BAR_FILLED = "\u2593"
export const BAR_EMPTY = "\u2591"

// Measured outer width of the panel box, in columns. Module scope on purpose: every tick rebuilds
// the whole tree without fine-grained reactivity, so a per-build signal would reset before anything
// could read it. `config.barWidth` only seeds this until the box reports a size.
const [panelWidth, setPanelWidthSignal] = createSignal(24)

/** Latest mounted panel box; written by `ref`, read by `onSizeChange` and the resync effect. */
let panelBox: BoxRenderable | undefined

/** Sets the panel's outer width in columns. The bars derive their length from it. */
export function setPanelWidth(width: number): void {
  setPanelWidthSignal(width)
}

/** Bar cells available inside the frame: 1 border + 1 padding column on each side. Clamped at
 *  zero, never raised: a floor above the real content width would push rows past the frame. */
export function effectiveWidth(): number {
  return Math.max(0, panelWidth() - 4)
}

/** Adopts the mounted box's measured width; non-finite and non-positive measurements are ignored. */
export function syncPanelWidth(): void {
  const width = panelBox?.width
  if (typeof width === "number" && Number.isFinite(width) && width > 0) setPanelWidth(width)
}

export type ResolvedOptions = Required<PluginOptions_>
export type Theme = TuiPluginApi["theme"]["current"]
// `Theme` also carries `thinkingOpacity: number`, so colour lookups are keyed by RGBA-valued tokens only.
export type ThemeColorKey = { [K in keyof Theme]: Theme[K] extends Theme["text"] ? K : never }[keyof Theme]
export type ThemeColor = Theme["text"]

// The theme has no bright yellow: its only yellows (`warning` ~34 deg, `markdownEmph` ~39 deg) sit
// only 10-15 deg of hue from the overview bar's `used` (`primary` ~24 deg) - the exact collision
// this panel must avoid. `out` therefore uses a hardcoded bright yellow instead of a theme token.
const OUT_COLOR = RGBA.fromHex("#ffff00")

// Final segment colours: `think` uses `secondary` (blue, hue ~215 deg), >=46 deg of hue from every
// other panel colour; `out` uses the hardcoded `OUT_COLOR` (`#ffff00`, pure yellow, hue 60 deg),
// whose tightest pairing is 36 deg against the overview bar's `used` (`primary`, ~24 deg).
const SEGMENT_TOKEN = {
  cached: "success",
  prompt: "accent",
  think: "secondary",
  reserved: "textMuted",
  free: "text",
} as const satisfies Record<Exclude<SegmentId, "out">, ThemeColorKey>

const LEGEND_LETTER = {
  cached: "c",
  prompt: "p",
  think: "t",
  out: "o",
  reserved: "r",
  free: "f",
} as const satisfies Record<SegmentId, string>

// `used` is not a `SegmentId`, so the overview bar cannot reuse `SEGMENT_TOKEN`/`LEGEND_LETTER`.
const OVERVIEW_TOKEN = {
  used: "primary",
  reserved: "textMuted",
  free: "text",
} as const satisfies Record<OverviewSegmentId, ThemeColorKey>

const OVERVIEW_LETTER = {
  used: "u",
  reserved: "r",
  free: "f",
} as const satisfies Record<OverviewSegmentId, string>

// Bar order == legend-row order: the overview trail first, then the fixed composition order.
const OVERVIEW_IDS: readonly OverviewSegmentId[] = ["used", "reserved", "free"]
const COMPOSITION_IDS: readonly SegmentId[] = ["cached", "prompt", "think", "out"]

/** Maps a segment id to its resolved theme colour; `out` uses the hardcoded bright yellow. */
export function segmentColor(id: SegmentId, theme: Theme): ThemeColor {
  return id === "out" ? OUT_COLOR : theme[SEGMENT_TOKEN[id]]
}

/** Maps an overview id to the theme token that colours it. */
export function overviewToken(id: OverviewSegmentId): ThemeColorKey {
  return OVERVIEW_TOKEN[id]
}

/** Resolves the context/output limits of the model that produced the last assistant turn. */
function modelLimits(
  providers: TuiPluginApi["state"]["provider"],
  providerID: string | undefined,
  modelID: string | undefined,
): UsageLimits | undefined {
  if (providerID === undefined || modelID === undefined) return undefined
  const provider = providers.find((item) => item.id === providerID)
  const model = provider?.models[modelID]
  if (model === undefined) return undefined
  return { context: model.limit.context, output: model.limit.output }
}

/** Computes the usage snapshot of the last assistant turn that carries output tokens. */
function sessionUsage(api: TuiPluginApi, assistant: AssistantUsage, config: ResolvedOptions): Usage {
  const limits = modelLimits(api.state.provider, assistant.providerID, assistant.modelID)
  return computeUsage({
    tokens: assistant.tokens,
    ...(limits === undefined ? {} : { limits }),
    exclude: config.exclude,
  })
}

/** Overview bar cells: `used` and `reserved` against `window`, `free` taking the remainder. */
export function overviewBarEntries(usage: Usage, config: ResolvedOptions, width: number) {
  const tokensById = new Map(usage.segments.map((segment) => [segment.id, segment.tokens]))
  return formatOverviewBar(usage.used, tokensById.get("reserved") ?? 0, usage.window, width, config.exclude)
}

/** Composition bar cells: `cached`/`prompt`/`think`/`out` against `used`. */
export function compositionBarEntries(usage: Usage, config: ResolvedOptions, width: number) {
  return formatCompositionBar(usage.segments, usage.used, width, config.exclude)
}

/** Legend entries for the overview bar. `used` is always shown; the other ids respect `exclude`. */
export function overviewLegendItems(usage: Usage, config: ResolvedOptions) {
  const tokensById = new Map(usage.segments.map((segment) => [segment.id, segment.tokens]))
  return OVERVIEW_IDS.filter((id) => id === "used" || !config.exclude.includes(id)).map((id) => ({
    id,
    letter: OVERVIEW_LETTER[id],
    label: formatCompact(id === "used" ? usage.used : (tokensById.get(id) ?? 0)),
  }))
}

/** Legend entries for the composition bar, honouring `exclude`. */
export function compositionLegendItems(usage: Usage, config: ResolvedOptions) {
  const tokensById = new Map(usage.segments.map((segment) => [segment.id, segment.tokens]))
  return COMPOSITION_IDS.filter((id) => !config.exclude.includes(id)).map((id) => ({
    id,
    letter: LEGEND_LETTER[id],
    label: formatCompact(tokensById.get(id) ?? 0),
  }))
}

const TITLE_LABEL = "Context"

/** What the title row renders: the bold label with the percentage, the label alone, or nothing. */
export type TitleRung = "both" | "label" | "none"

/** Picks the title-row rung from the content width and the rendered percentage text; the
 *  percentage is dropped before the label, so no text run is ever cut in half. */
export function titleRung(eff: number, percentText: string): TitleRung {
  if (eff < TITLE_LABEL.length) return "none"
  return eff >= TITLE_LABEL.length + percentText.length ? "both" : "label"
}

/** A legend item with its colours resolved, ready to render. */
type LegendCell = { letter: string; label: string; marker: string; color: ThemeColor }

/** How a legend row degrades: counts on one line, counts stacked, marker and letter only, or none. */
export type LegendRung = "full" | "stacked" | "markers" | "omit"

/** Picks the legend-row rung for the complete labels and the content width, cheapest first. Cell
 *  budgets, with `n` items and `gaps = n - 1`: `full` = one line with counts; `stacked` = marker
 *  row plus a count row, each item as wide as its count; `markers` = marker and letter only;
 *  `omit` = no row. `stacked` is what lets a mid-width panel keep every count. */
export function legendRung(labels: readonly string[], eff: number): LegendRung {
  if (labels.length === 0) return "omit"
  const gaps = labels.length - 1
  const full = labels.reduce((cells, label) => cells + 4 + label.length, 0) + gaps
  if (full <= eff) return "full"
  const stacked = labels.reduce((cells, label) => cells + Math.max(3, label.length), 0) + gaps
  if (stacked <= eff) return "stacked"
  const markers = 3 * labels.length + gaps
  return markers <= eff ? "markers" : "omit"
}

/** Renders one legend row at the rung its width allows; `null` omits the row. */
function legendRow(cells: readonly LegendCell[], eff: number, muted: ThemeColor) {
  const rung = legendRung(
    cells.map((cell) => cell.label),
    eff,
  )
  if (rung === "omit") return null
  return (
    <box flexDirection="row" gap={1}>
      {cells.map((cell) =>
        rung === "stacked" ? (
          <box flexDirection="column" width={Math.max(3, cell.label.length)}>
            <text fg={cell.color}>{`${cell.marker} ${cell.letter}`}</text>
            <text fg={muted}>{cell.label}</text>
          </box>
        ) : (
          <box flexDirection="row" gap={1}>
            <text fg={cell.color}>{`${cell.marker} ${cell.letter}`}</text>
            {rung === "full" ? <text fg={muted}>{cell.label}</text> : null}
          </box>
        ),
      )}
    </box>
  )
}

/** Builds the panel element tree for one usage snapshot. Deliberately a plain function: the slot body
 *  calls it directly, so every slot re-run rebuilds the tree and re-reads the session data. */
export function renderPanel(api: TuiPluginApi, sessionId: string, config: ResolvedOptions) {
  const theme = api.theme.current
  const messages = api.state.session.messages(sessionId)
  const assistant = lastAssistantWithTokens(messages)
  const usage = assistant === undefined ? undefined : sessionUsage(api, assistant, config)
  const eff = effectiveWidth()
  const percentText = usage === undefined ? undefined : `${formatPercent(usage.percent)} used`
  const title = titleRung(eff, percentText ?? "")
  return (
    <box
      flexDirection="column"
      gap={1}
      border
      borderColor={theme.borderSubtle}
      paddingLeft={1}
      paddingRight={1}
      ref={(element) => {
        panelBox = element
      }}
      onSizeChange={() => {
        syncPanelWidth()
      }}
    >
      <box flexDirection="row" justifyContent="space-between">
        {title === "none" ? null : (
          <text fg={theme.text}>
            <b>{TITLE_LABEL}</b>
          </text>
        )}
        {title === "both" && percentText !== undefined ? (
          <text fg={theme[overviewToken("used")]}>{percentText}</text>
        ) : null}
      </box>
      {usage === undefined ? (
        <text fg={theme.textMuted}>no assistant turns yet</text>
      ) : (
        <box flexDirection="column" gap={1}>
          <box flexDirection="row">
            {overviewBarEntries(usage, config, eff).map((entry) => (
              <text fg={theme[overviewToken(entry.id)]}>
                {(entry.id === "free" ? BAR_EMPTY : BAR_FILLED).repeat(entry.cells)}
              </text>
            ))}
          </box>
          <box flexDirection="row">
            {compositionBarEntries(usage, config, eff).map((entry) => (
              <text fg={segmentColor(entry.id, theme)}>{BAR_FILLED.repeat(entry.cells)}</text>
            ))}
          </box>
          {config.showLegend
            ? legendRow(
                overviewLegendItems(usage, config).map((item) => ({
                  letter: item.letter,
                  label: item.label,
                  marker: item.id === "free" ? BAR_EMPTY : BAR_FILLED,
                  color: theme[overviewToken(item.id)],
                })),
                eff,
                theme.textMuted,
              )
            : null}
          {config.showLegend
            ? legendRow(
                compositionLegendItems(usage, config).map((item) => ({
                  letter: item.letter,
                  label: item.label,
                  marker: BAR_FILLED,
                  color: segmentColor(item.id, theme),
                })),
                eff,
                theme.textMuted,
              )
            : null}
        </box>
      )}
    </box>
  )
}
