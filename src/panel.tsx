/** @jsxImportSource @opentui/solid */
import type { Plugin } from "@opencode/plugin/tui"
import { RGBA, type BoxRenderable } from "@opentui/core"
import { createMemo, createSignal, onMount, Show, type Accessor } from "solid-js"
import { formatCompact, formatCompositionBar, formatOverviewBar, formatPercent } from "./format"
import type { OverviewSegmentId, PluginOptions_, SegmentId, Usage, UsageLimits } from "./types"
import { computeUsage, lastAssistantWithTokens, type AssistantUsage } from "./usage"

export const BAR_FILLED = "\u2593"
export const BAR_EMPTY = "\u2591"

/** Bar cells available inside the panel: 1 padding column on each side. Clamped at zero, never
 *  raised: a floor above the real content width would push rows past the panel. */
export function effectiveWidth(width: number): number {
  return Math.max(0, width - 2)
}

export type ResolvedOptions = Required<PluginOptions_>
/** Flat host-independent palette shared by bars and their legends. */
export type Theme = Record<"primary" | "secondary" | "accent" | "success" | "warning" | "text" | "textMuted", RGBA>
export type ThemeColorKey = keyof Theme
export type ThemeColor = RGBA

export function resolveTheme(theme: Plugin.Context["theme"]): Theme {
  return {
    primary: theme.hue.interactive[500],
    secondary: theme.text.feedback.info.base,
    accent: theme.hue.accent[500],
    success: theme.text.feedback.success.base,
    warning: theme.text.feedback.warning.base,
    text: theme.text.base,
    textMuted: theme.text.muted,
  }
}

// Preserve the recognizable output marker across host themes.
const OUT_COLOR = RGBA.fromHex("#ffff00")

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
export function modelLimits(
  models: ReturnType<Plugin.Context["data"]["location"]["model"]["list"]>,
  providerID: string | undefined,
  modelID: string | undefined,
): UsageLimits | undefined {
  if (providerID === undefined || modelID === undefined) return undefined
  const model = models?.find((item) => item.providerID === providerID && item.id === modelID)
  if (model === undefined) return undefined
  return { context: model.limit.context, output: model.limit.output }
}

/** Computes the usage snapshot of the last assistant turn that carries output tokens. */
function sessionUsage(context: Plugin.Context, sessionID: string, assistant: AssistantUsage, config: ResolvedOptions): Usage {
  const session = context.data.session.get(sessionID)
  const models = session === undefined ? undefined : context.data.location.model.list(session.location)
  const limits = modelLimits(models, assistant.providerID, assistant.modelID)
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

/** V2 adapter: normalize the host's session, model, and theme stores for the view. */
export function ContextPanel(props: { context: Plugin.Context; sessionID: string; config: ResolvedOptions }) {
  const usage = createMemo(() => {
    const session = props.context.data.session.get(props.sessionID)
    const messages = props.context.data.session.message.list(props.sessionID)
    const assistant = lastAssistantWithTokens(messages, session?.revert?.messageID)
    return assistant === undefined ? undefined : sessionUsage(props.context, props.sessionID, assistant, props.config)
  })
  return <UsagePanel usage={usage()} theme={resolveTheme(props.context.theme)} config={props.config} />
}

/** Both adapters render this view; each mounted sidebar owns its measurement. */
export function UsagePanel(props: { usage: Usage | undefined; theme: Theme; config: ResolvedOptions }) {
  const [panelWidth, setPanelWidth] = createSignal(props.config.barWidth)
  let panelBox: BoxRenderable | undefined
  const syncPanelWidth = () => {
    const width = panelBox?.width
    if (typeof width === "number" && Number.isFinite(width) && width > 0) setPanelWidth(width)
  }
  onMount(syncPanelWidth)
  const theme = () => props.theme
  const usage = () => props.usage
  const eff = () => effectiveWidth(panelWidth())
  const percentText = () => usage() === undefined ? "" : `${formatPercent(usage()!.percent)} used`
  const title = () => titleRung(eff(), percentText())
  return (
    <box
      id="opencode-tui-context-panel"
      flexDirection="column"
      gap={1}
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
        {title() === "none" ? null : (
          <text fg={theme().text}>
            <b>{TITLE_LABEL}</b>
          </text>
        )}
        {title() === "both" && percentText() ? (
          <text fg={theme()[overviewToken("used")]}>{percentText()}</text>
        ) : null}
      </box>
      <Show when={usage()} fallback={<text fg={theme().textMuted}>no usage snapshot yet</text>}>
        {(snapshot: Accessor<Usage>) => (
        <box flexDirection="column" gap={1}>
          <box flexDirection="row">
            {overviewBarEntries(snapshot(), props.config, eff()).map((entry) => (
              <text fg={theme()[overviewToken(entry.id)]}>
                {(entry.id === "free" ? BAR_EMPTY : BAR_FILLED).repeat(entry.cells)}
              </text>
            ))}
          </box>
          <box flexDirection="row">
            {compositionBarEntries(snapshot(), props.config, eff()).map((entry) => (
              <text fg={segmentColor(entry.id, theme())}>{BAR_FILLED.repeat(entry.cells)}</text>
            ))}
          </box>
          {props.config.showLegend
            ? legendRow(
                overviewLegendItems(snapshot(), props.config).map((item) => ({
                  letter: item.letter,
                  label: item.label,
                  marker: item.id === "free" ? BAR_EMPTY : BAR_FILLED,
                  color: theme()[overviewToken(item.id)],
                })),
                eff(),
                theme().textMuted,
              )
            : null}
          {props.config.showLegend
            ? legendRow(
                compositionLegendItems(snapshot(), props.config).map((item) => ({
                  letter: item.letter,
                  label: item.label,
                  marker: BAR_FILLED,
                  color: segmentColor(item.id, theme()),
                })),
                eff(),
                theme().textMuted,
              )
            : null}
        </box>
        )}
      </Show>
    </box>
  )
}
