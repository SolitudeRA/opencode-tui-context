/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { createSignal } from "solid-js"
import { formatBar, formatCost, formatPercent, formatTokens } from "./format"
import { parseOptions } from "./options"
import type { PluginOptions_, Usage, UsageLimits } from "./types"
import { computeUsage, lastAssistantWithTokens } from "./usage"

// Bar glyph and slot order are fixed by the plan (baseline order: 150; this plugin takes 60).
const BAR_CELL = "\u2501"
const SLOT_ORDER = 60

type ResolvedOptions = Required<PluginOptions_>

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

/**
 * Draws the segmented bar from `formatBar`: every allocation renders as its `cells` count of `━`.
 * Task 12 replaces the single colour with per-segment colours and appends the legend here.
 */
function barText(usage: Usage, config: ResolvedOptions): string {
  return formatBar(usage.segments, usage.window, config.barWidth, config.exclude)
    .map((entry) => BAR_CELL.repeat(entry.cells))
    .join("")
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
        <box flexDirection="column" gap={1}>
          <text fg={theme().text}>{barText(current, props.config)}</text>
          <text fg={theme().text}>{`${formatPercent(current.percent)} used`}</text>
          <text fg={theme().textMuted}>
            {`${formatTokens(current.used)} / ${current.known ? formatTokens(current.window) : "--"} tokens`}
          </text>
          {props.config.showCost ? <text fg={theme().textMuted}>{`${formatCost(current.cost)} spent`}</text> : null}
        </box>
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
