/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui"
import type { BoxRenderable } from "@opentui/core"
import { createEffect, createSignal } from "solid-js"
import { formatCompact, formatCompositionBar, formatOverviewBar, formatPercent } from "./format"
import { parseOptions } from "./options"
import type { OverviewSegmentId, PluginOptions_, SegmentId, Usage, UsageLimits } from "./types"
import { computeUsage, lastAssistantWithTokens, type AssistantUsage } from "./usage"

const BAR_FILLED = "\u2593"
const BAR_EMPTY = "\u2591"
const SLOT_ORDER = 60
// Minimum spacing between two repaints (plan task 13; baseline throttle is `tui.js:210-224`).
const REPAINT_INTERVAL_MS = 50

// Measured outer width of the panel box, in columns. Module scope on purpose: every tick rebuilds
// the whole tree (no fine-grained reactivity — notepad T11), so a per-build signal would reset
// before anything could read it. `config.barWidth` only seeds this until the box reports a size
// (same role as visual-cache `DEFAULT_PANEL_WIDTH`, index.tsx:476).
const [panelWidth, setPanelWidth] = createSignal(24)
/** Bar cells available inside the frame: 1 border + 1 padding column on each side. */
const effectiveWidth = () => Math.max(8, panelWidth() - 2 - 2)
/** Latest mounted panel box; written by `ref`, read by `onSizeChange` and the resync effect. */
let panelBox: BoxRenderable | undefined

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

// Bar order == legend-row order (overview trail, then the baseline composition order `tui.js:42-49`).
const OVERVIEW_IDS: readonly OverviewSegmentId[] = ["used", "reserved", "free"]
const COMPOSITION_IDS: readonly SegmentId[] = ["cached", "prompt", "think", "out"]

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

/** Renders the overview and composition bars plus their gated legend rows for one usage snapshot. */
function usageLines(api: TuiPluginApi, usage: Usage, config: ResolvedOptions) {
  const theme = api.theme.current
  const width = effectiveWidth()
  const tokensById = new Map(usage.segments.map((segment) => [segment.id, segment.tokens]))
  // `Usage` has no `reserved`/`free` fields: the segment list is their only source, and a missing
  // entry means zero (it drops zero-token segments; excluded ids are skipped from the legend).
  const overviewTokens = (id: OverviewSegmentId): number =>
    id === "used" ? usage.used : (tokensById.get(id) ?? 0)
  const overviewBar = formatOverviewBar(usage.used, overviewTokens("reserved"), usage.window, width, config.exclude)
  const compositionBar = formatCompositionBar(usage.segments, usage.used, width, config.exclude)
  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="row">
        {overviewBar.map((entry) => (
          <text fg={theme[OVERVIEW_TOKEN[entry.id]]}>
            {(entry.id === "free" ? BAR_EMPTY : BAR_FILLED).repeat(entry.cells)}
          </text>
        ))}
      </box>
      <box flexDirection="row">
        {compositionBar.map((entry) => (
          <text fg={segmentColor(entry.id, theme)}>{BAR_FILLED.repeat(entry.cells)}</text>
        ))}
      </box>
      {config.showLegend ? (
        <box flexDirection="row" gap={1}>
          {OVERVIEW_IDS.filter((id) => id === "used" || !config.exclude.includes(id)).map((id) => (
            <box flexDirection="row" gap={1}>
              <text fg={theme[OVERVIEW_TOKEN[id]]}>
                {`${id === "free" ? BAR_EMPTY : BAR_FILLED} ${OVERVIEW_LETTER[id]}`}
              </text>
              <text fg={theme.textMuted}>{formatCompact(overviewTokens(id))}</text>
            </box>
          ))}
        </box>
      ) : null}
      {config.showLegend ? (
        <box flexDirection="row" gap={1}>
          {COMPOSITION_IDS.filter((id) => !config.exclude.includes(id)).map((id) => (
            <box flexDirection="row" gap={1}>
              <text fg={segmentColor(id, theme)}>{`${BAR_FILLED} ${LEGEND_LETTER[id]}`}</text>
              <text fg={theme.textMuted}>{formatCompact(tokensById.get(id) ?? 0)}</text>
            </box>
          ))}
        </box>
      ) : null}
    </box>
  )
}

/** Computes the usage snapshot of the last assistant turn that carries output tokens. */
function sessionUsage(
  api: TuiPluginApi,
  sessionId: string,
  assistant: AssistantUsage,
  config: ResolvedOptions,
): Usage {
  const limits = modelLimits(api.state.provider, assistant.providerID, assistant.modelID)
  return computeUsage({
    tokens: assistant.tokens,
    ...(limits === undefined ? {} : { limits }),
    exclude: config.exclude,
  })
}

/** Builds the panel element tree for one usage snapshot. Deliberately a plain function: the slot body
 *  calls it directly, so every slot re-run rebuilds the tree and re-reads the session data. */
function renderPanel(api: TuiPluginApi, sessionId: string, config: ResolvedOptions) {
  const theme = api.theme.current
  const messages = api.state.session.messages(sessionId)
  const assistant = lastAssistantWithTokens(messages)
  const usage = assistant === undefined ? undefined : sessionUsage(api, sessionId, assistant, config)
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
        const w = panelBox?.width
        if (typeof w === "number" && Number.isFinite(w) && w > 0) setPanelWidth(w)
      }}
    >
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.text}>
          <b>Context</b>
        </text>
        {usage === undefined ? null : (
          <text fg={tierColor(usage.percent, theme)}>{`${formatPercent(usage.percent)} used`}</text>
        )}
      </box>
      {usage === undefined ? (
        <text fg={theme.textMuted}>no assistant turns yet</text>
      ) : (
        usageLines(api, usage, config)
      )}
    </box>
  )
}

const tui: TuiPlugin = async (api, options) => {
  const config = parseOptions(options)
  // `barWidth` is only the pre-measurement starting width; the box measurement replaces it.
  setPanelWidth(config.barWidth)
  // The tick signal is the repaint trigger: reading it in the slot body subscribes this panel to
  // the throttled refresh wired below to the session event bus.
  const [tick, setTick] = createSignal(0)

  // Mirror of visual-cache (index.tsx:972-981): `onSizeChange` alone can miss (re)mount cycles,
  // so resync from the live box after every repaint — `tick` is this bundle's rebuild trigger.
  createEffect(() => {
    tick()
    const w = panelBox?.width
    if (typeof w === "number" && Number.isFinite(w) && w > 0) setPanelWidth(w)
  })

  const repaint = () => {
    // The signal bump re-runs the slot body (this bundle has no fine-grained reactivity — see
    // notepad T11); requestRender() draws the resulting frame.
    setTick((n) => n + 1)
    api.renderer.requestRender()
  }

  // Leading-edge throttle: events landing inside the window are dropped, the first event after it
  // repaints. No timer is scheduled, so dispose has no pending callback to cancel.
  let lastRepaint = 0
  const throttledRepaint = () => {
    const now = Date.now()
    if (now - lastRepaint < REPAINT_INTERVAL_MS) return
    lastRepaint = now
    repaint()
  }

  const onSessionEvent = () => {
    throttledRepaint()
  }

  const unsubs: Array<() => void> = [
    api.event.on("message.updated", onSessionEvent),
    api.event.on("message.part.updated", onSessionEvent),
    api.event.on("session.updated", onSessionEvent),
    api.event.on("session.idle", onSessionEvent),
  ]
  api.lifecycle.onDispose(() => {
    for (const unsubscribe of unsubs) unsubscribe()
  })

  api.slots.register({
    order: SLOT_ORDER,
    slots: {
      sidebar_content(_ctx, props) {
        tick()
        return renderPanel(api, props.session_id, config)
      },
    },
  })
}

const plugin = { id: "opencode-tui-context", tui }
export default plugin satisfies TuiPluginModule & { id: string }
