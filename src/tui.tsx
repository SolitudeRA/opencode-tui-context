/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { createSignal } from "solid-js"
import { formatBar, formatCompact, formatCost, formatPercent, formatTokens } from "./format"
import { parseOptions } from "./options"
import type { PluginOptions_, SegmentId, Usage, UsageLimits } from "./types"
import { computeUsage, lastAssistantWithTokens } from "./usage"

// Bar glyph, legend marker and slot order are fixed by the plan (baseline order: 150; this plugin takes 60).
const BAR_CELL = "\u2501"
const LEGEND_MARK = "\u258D"
const SLOT_ORDER = 60

type ResolvedOptions = Required<PluginOptions_>
type Theme = TuiPluginApi["theme"]["current"]
// `Theme` also carries `thinkingOpacity: number`, so colour lookups are keyed by RGBA-valued tokens only.
type ThemeColorKey = { [K in keyof Theme]: Theme[K] extends Theme["text"] ? K : never }[keyof Theme]
type ThemeColor = Theme["text"]

// Baseline segment colours (tui.js:394-416) and tier thresholds (tui.js:417-422).
const SEGMENT_TOKEN = {
  cached: "success",
  prompt: "accent",
  think: "warning",
  out: "info",
  reserved: "textMuted",
  free: "text",
} as const satisfies Record<SegmentId, ThemeColorKey>

const LEGEND_LETTER = {
  cached: "c",
  prompt: "p",
  think: "t",
  out: "o",
  reserved: "r",
  free: "f",
} as const satisfies Record<SegmentId, string>

function segmentColor(id: SegmentId, theme: Theme): ThemeColor {
  return theme[SEGMENT_TOKEN[id]]
}

function tierColor(percent: number, theme: Theme): ThemeColor {
  if (percent >= 100) return theme.error
  if (percent >= 75) return theme.warning
  if (percent >= 50) return theme.accent
  return theme.success
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

/** Renders the coloured bar, gated legend, tiered percent and totals for one usage snapshot. */
function usageLines(api: TuiPluginApi, usage: Usage, config: ResolvedOptions) {
  const theme = api.theme.current
  const bar = formatBar(usage.segments, usage.window, config.barWidth, config.exclude)
  const tokensById = new Map(usage.segments.map((segment) => [segment.id, segment.tokens]))
  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="row">
        {bar.map((entry) => (
          <text fg={segmentColor(entry.id, theme)}>{BAR_CELL.repeat(entry.cells)}</text>
        ))}
      </box>
      {config.showLegend ? (
        <box flexDirection="row" gap={1}>
          {bar.map((entry) => (
            <box flexDirection="row">
              <text fg={segmentColor(entry.id, theme)}>{`${LEGEND_MARK}${LEGEND_LETTER[entry.id]}`}</text>
              <text fg={theme.textMuted}>{formatCompact(tokensById.get(entry.id) ?? 0)}</text>
            </box>
          ))}
        </box>
      ) : null}
      <text fg={tierColor(usage.percent, theme)}>{` ${formatPercent(usage.percent)} used`}</text>
      <text fg={theme.textMuted}>
        {`${formatTokens(usage.used)} / ${usage.known ? formatTokens(usage.window) : "--"} tokens`}
      </text>
      {config.showCost ? <text fg={theme.textMuted}>{`${formatCost(usage.cost)} spent`}</text> : null}
    </box>
  )
}

function Panel(props: { api: TuiPluginApi; sessionId: string; config: ResolvedOptions }) {
  const theme = () => props.api.theme.current
  const usage = (): Usage | undefined => {
    const assistant = lastAssistantWithTokens(props.api.state.session.messages(props.sessionId))
    if (assistant === undefined) return undefined
    const limits = modelLimits(props.api.state.provider, assistant.providerID, assistant.modelID)
    return computeUsage({
      tokens: assistant.tokens,
      ...(limits === undefined ? {} : { limits }),
      cost: props.api.state.session.get(props.sessionId)?.cost ?? 0,
      exclude: props.config.exclude,
    })
  }

  const current = usage()
  return (
    <box flexDirection="column" gap={1}>
      <text fg={theme().text}>
        <b>Context</b>
      </text>
      {current === undefined ? (
        <text fg={theme().textMuted}>no assistant turns yet</text>
      ) : (
        usageLines(props.api, current, props.config)
      )}
    </box>
  )
}

const tui: TuiPlugin = async (api, options) => {
  const config = parseOptions(options)
  // The tick signal is the repaint trigger: reading it in the slot body subscribes this panel to
  // the throttled refresh that task 13 wires to the session event bus. Until then the panel
  // renders once when the slot mounts.
  const [tick, setTick] = createSignal(0)
  api.slots.register({
    order: SLOT_ORDER,
    slots: {
      sidebar_content(_ctx, props) {
        tick()
        return <Panel api={api} sessionId={props.session_id} config={config} />
      },
    },
  })
}

const plugin = { id: "opencode-tui-context", tui }
export default plugin satisfies TuiPluginModule & { id: string }
