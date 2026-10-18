import type { TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui"
import { createMemo, createSignal, type Accessor } from "solid-js"
import { parseOptions } from "../options"
import { UsagePanel, type ResolvedOptions } from "../panel"
import { computeUsage } from "../usage"
import { subscribeRefresh } from "./refresh"
import { lastAssistantWithTokens, modelLimits } from "./usage"

function ContextPanel(props: {
  api: TuiPluginApi
  sessionID: string
  config: ResolvedOptions
  revision: Accessor<number>
}) {
  const usage = createMemo(() => {
    props.revision()
    const session = props.api.state.session.get(props.sessionID)
    const assistant = lastAssistantWithTokens(
      props.api.state.session.messages(props.sessionID),
      session?.revert?.messageID,
      (messageID) => props.api.state.part(messageID),
    )
    if (assistant === undefined) return undefined
    const limits = modelLimits(props.api.state.provider, assistant.providerID, assistant.modelID)
    return computeUsage({
      tokens: assistant.tokens,
      ...(limits === undefined ? {} : { limits }),
      exclude: props.config.exclude,
    })
  })
  return <UsagePanel usage={usage()} theme={props.api.theme.current} config={props.config} />
}

/** V1 owns event subscriptions and automatically removes registered slots on disposal. */
export const tui: TuiPlugin = async (api, options) => {
  const config = parseOptions(options)
  const [revision, setRevision] = createSignal(0)
  subscribeRefresh(api, () => {
    setRevision((value) => value + 1)
    api.renderer.requestRender()
  })
  api.slots.register({
    order: 60,
    slots: {
      sidebar_content(_context, props) {
        return <ContextPanel api={api} sessionID={props.session_id} config={config} revision={revision} />
      },
    },
  })
}
