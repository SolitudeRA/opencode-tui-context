/** @jsxImportSource @opentui/solid */
import { appendFileSync } from "node:fs"
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { createSignal } from "solid-js"
import { formatBar, formatCompact, formatCost, formatPercent, formatTokens } from "./format"
import { parseOptions } from "./options"
import type { PluginOptions_, SegmentId, Usage, UsageLimits } from "./types"
import { computeUsage, lastAssistantWithTokens, type AssistantUsage } from "./usage"

// Bar glyph, legend marker and slot order are fixed by the plan (baseline order: 150; this plugin takes 60).
const BAR_CELL = "\u2501"
const LEGEND_MARK = "\u258D"
const SLOT_ORDER = 60
// Minimum spacing between two repaints (plan task 13; baseline throttle is `tui.js:210-224`).
const REPAINT_INTERVAL_MS = 50
// verification probe (plan task 13 acceptance) — safe to remove after QA.
// Absolute on purpose: opencode loads this plugin from its own process, whose cwd is not the project root.
const EVENT_PROBE_PATH = "/mnt/e/Coding/opencode-context-monitor/verification/13-events.log"
// verification probe (plan task 20) — temporary, safe to remove after QA.
// Absolute for the same reason as EVENT_PROBE_PATH.
const RENDER_PROBE_PATH = "/mnt/e/Coding/opencode-context-monitor/verification/20-slot-trace.log"

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
    cost: api.state.session.get(sessionId)?.cost ?? 0,
    exclude: config.exclude,
  })
}

// Temporary render trace (plan task 20): the ordinal resets per process start and a line is written
// only when the (messages.length, found, used) tuple changes, so it can never spam one line per frame.
let renderOrdinal = 0
let lastRenderTuple = ""
let resolvedSolidModule: string | undefined

function solidModuleSpecifier(): string {
  if (resolvedSolidModule !== undefined) return resolvedSolidModule
  try {
    resolvedSolidModule = typeof import.meta.resolve === "function" ? import.meta.resolve("solid-js") : "no-import-meta-resolve"
  } catch {
    resolvedSolidModule = "resolve-failed"
  }
  return resolvedSolidModule
}

function recordRenderProbe(messages: number, usage: Usage | undefined): void {
  renderOrdinal += 1
  const used = usage === undefined ? "-" : String(usage.used)
  const tuple = `${messages}|${usage !== undefined}|${used}`
  if (tuple === lastRenderTuple) return
  lastRenderTuple = tuple
  try {
    appendFileSync(
      RENDER_PROBE_PATH,
      `${new Date().toISOString()} render n=${renderOrdinal} messages=${messages} found=${usage !== undefined} used=${used} sol=${solidModuleSpecifier()}\n`,
    )
  } catch {
    // A missing probe directory on another machine must never break the panel.
  }
}

/** Builds the panel element tree for one usage snapshot. Deliberately a plain function: the slot body
 *  calls it directly, so every slot re-run rebuilds the tree and re-reads the session data. */
function renderPanel(api: TuiPluginApi, sessionId: string, config: ResolvedOptions) {
  const theme = api.theme.current
  const messages = api.state.session.messages(sessionId)
  const assistant = lastAssistantWithTokens(messages)
  const usage = assistant === undefined ? undefined : sessionUsage(api, sessionId, assistant, config)
  recordRenderProbe(messages.length, usage)
  return (
    <box flexDirection="column" gap={1}>
      <text fg={theme.text}>
        <b>Context</b>
      </text>
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
  // The tick signal is the repaint trigger: reading it in the slot body subscribes this panel to
  // the throttled refresh wired below to the session event bus.
  const [tick, setTick] = createSignal(0)

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

  // verification probe (plan task 13 acceptance) — safe to remove after QA
  let delivered = 0
  const onSessionEvent = (type: string) => {
    delivered += 1
    try {
      appendFileSync(EVENT_PROBE_PATH, `${new Date().toISOString()} event=${type} n=${delivered}\n`)
    } catch {
      // A missing probe directory on another machine must never break the panel.
    }
    throttledRepaint()
  }

  const unsubs: Array<() => void> = [
    api.event.on("message.updated", (event) => onSessionEvent(event.type)),
    api.event.on("message.part.updated", (event) => onSessionEvent(event.type)),
    api.event.on("session.updated", (event) => onSessionEvent(event.type)),
    api.event.on("session.idle", (event) => onSessionEvent(event.type)),
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
