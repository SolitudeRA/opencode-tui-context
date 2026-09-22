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

/** Bar cells available inside the frame: 1 border + 1 padding column on each side. */
export function effectiveWidth(): number {
  return Math.max(8, panelWidth() - 2 - 2)
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

/** Builds the panel element tree for one usage snapshot. Deliberately a plain function: the slot body
 *  calls it directly, so every slot re-run rebuilds the tree and re-reads the session data. */
export function renderPanel(api: TuiPluginApi, sessionId: string, config: ResolvedOptions) {
  const theme = api.theme.current
  const messages = api.state.session.messages(sessionId)
  const assistant = lastAssistantWithTokens(messages)
  const usage = assistant === undefined ? undefined : sessionUsage(api, assistant, config)
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
        <text fg={theme.text}>
          <b>Context</b>
        </text>
        {usage === undefined ? null : (
          <text fg={theme[overviewToken("used")]}>{`${formatPercent(usage.percent)} used`}</text>
        )}
      </box>
      {usage === undefined ? (
        <text fg={theme.textMuted}>no assistant turns yet</text>
      ) : (
        <box flexDirection="column" gap={1}>
          <box flexDirection="row">
            {overviewBarEntries(usage, config, effectiveWidth()).map((entry) => (
              <text fg={theme[overviewToken(entry.id)]}>
                {(entry.id === "free" ? BAR_EMPTY : BAR_FILLED).repeat(entry.cells)}
              </text>
            ))}
          </box>
          <box flexDirection="row">
            {compositionBarEntries(usage, config, effectiveWidth()).map((entry) => (
              <text fg={segmentColor(entry.id, theme)}>{BAR_FILLED.repeat(entry.cells)}</text>
            ))}
          </box>
          {config.showLegend ? (
            <box flexDirection="row" gap={1}>
              {overviewLegendItems(usage, config).map((item) => (
                <box flexDirection="row" gap={1}>
                  <text fg={theme[overviewToken(item.id)]}>
                    {`${item.id === "free" ? BAR_EMPTY : BAR_FILLED} ${item.letter}`}
                  </text>
                  <text fg={theme.textMuted}>{item.label}</text>
                </box>
              ))}
            </box>
          ) : null}
          {config.showLegend ? (
            <box flexDirection="row" gap={1}>
              {compositionLegendItems(usage, config).map((item) => (
                <box flexDirection="row" gap={1}>
                  <text fg={segmentColor(item.id, theme)}>{`${BAR_FILLED} ${item.letter}`}</text>
                  <text fg={theme.textMuted}>{item.label}</text>
                </box>
              ))}
            </box>
          ) : null}
        </box>
      )}
    </box>
  )
}
