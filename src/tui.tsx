/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui"
import type { BoxRenderable } from "@opentui/core"
import { createEffect, createSignal, type JSX } from "solid-js"
import { formatBar, formatCompact, formatPercent, formatTokens } from "./format"
import { parseOptions } from "./options"
import type { PluginOptions_, SegmentId, Usage, UsageLimits } from "./types"
import { computeUsage, lastAssistantWithTokens, type AssistantUsage } from "./usage"

// Bar glyphs, legend marker and slot orders are fixed by the plan (baseline order: 150; this plugin takes 60).
const BAR_FILLED = "\u2593"
const BAR_EMPTY = "\u2591"
const LEGEND_MARK = "\u258D"
const SLOT_ORDER = 60
// One registration per block so the sidebar can order them against other plugins' blocks; the
// plan's final order is context 60 → todo 100 → mcp 1000.
const TODO_SLOT_ORDER = 100
const MCP_SLOT_ORDER = 1000
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

// Todo status colours; the SDK types `status` as a plain string, so unknown values fall back to textMuted.
const TODO_TOKEN = {
  completed: "success",
  in_progress: "accent",
  pending: "textMuted",
  cancelled: "textMuted",
} as const satisfies Record<string, ThemeColorKey>

// MCP server status colours (host enum: connected | disabled | failed | needs_auth | needs_client_registration).
const MCP_TOKEN = {
  connected: "success",
  failed: "error",
  needs_auth: "warning",
  needs_client_registration: "warning",
  disabled: "textMuted",
} as const satisfies Record<string, ThemeColorKey>

function segmentColor(id: SegmentId, theme: Theme): ThemeColor {
  return theme[SEGMENT_TOKEN[id]]
}

function todoColor(status: string, theme: Theme): ThemeColor {
  return theme[TODO_TOKEN[status as keyof typeof TODO_TOKEN] ?? "textMuted"]
}

function mcpColor(status: string, theme: Theme): ThemeColor {
  return theme[MCP_TOKEN[status as keyof typeof MCP_TOKEN] ?? "textMuted"]
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
  const bar = formatBar(usage.segments, usage.window, effectiveWidth(), config.exclude)
  const tokensById = new Map(usage.segments.map((segment) => [segment.id, segment.tokens]))
  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="row">
        {bar.map((entry) => (
          <text fg={segmentColor(entry.id, theme)}>
            {(entry.id === "free" ? BAR_EMPTY : BAR_FILLED).repeat(entry.cells)}
          </text>
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

/** Sidebar frame shared by the todo and mcp blocks; same border/padding as `renderPanel`. */
function sidebarFrame(title: string, theme: Theme, body: JSX.Element) {
  return (
    <box
      flexDirection="column"
      gap={1}
      border
      borderColor={theme.borderSubtle}
      paddingLeft={1}
      paddingRight={1}
    >
      <text fg={theme.text}>
        <b>{title}</b>
      </text>
      {body}
    </box>
  )
}

/** Flattens one sidebar line and caps it at the measured width so long content cannot wrap. */
function clampLine(text: string, width: number): string {
  const line = text.replace(/\s+/g, " ").trim()
  if (line.length <= width) return line
  return `${line.slice(0, Math.max(1, width - 1))}\u2026`
}

/** Builds the `Todo` block for one session: one coloured line per item, no frame when the list is empty. */
function renderTodo(api: TuiPluginApi, sessionId: string, config: ResolvedOptions) {
  const todos = api.state.session.todo(sessionId)
  if (todos.length === 0) return undefined
  const theme = api.theme.current
  const width = effectiveWidth()
  return sidebarFrame(
    "Todo",
    theme,
    <box flexDirection="column">
      {todos.map((todo) => (
        <text fg={todoColor(todo.status, theme)}>{clampLine(todo.content, width)}</text>
      ))}
    </box>,
  )
}

/** Builds the `MCP` block: one `name status` line per server, no frame when there are no servers. */
function renderMcp(api: TuiPluginApi, config: ResolvedOptions) {
  const servers = api.state.mcp()
  if (servers.length === 0) return undefined
  const theme = api.theme.current
  const width = effectiveWidth()
  return sidebarFrame(
    "MCP",
    theme,
    <box flexDirection="column">
      {servers.map((server) => (
        <text fg={mcpColor(server.status, theme)}>{clampLine(`${server.name} ${server.status}`, width)}</text>
      ))}
    </box>,
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

  api.slots.register({
    order: TODO_SLOT_ORDER,
    slots: {
      sidebar_content(_ctx, props) {
        tick()
        return renderTodo(api, props.session_id, config)
      },
    },
  })

  api.slots.register({
    order: MCP_SLOT_ORDER,
    slots: {
      sidebar_content(_ctx, _props) {
        tick()
        return renderMcp(api, config)
      },
    },
  })
}

const plugin = { id: "opencode-tui-context", tui }
export default plugin satisfies TuiPluginModule & { id: string }
