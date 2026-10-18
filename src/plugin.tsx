import type { Plugin } from "@opencode/plugin/tui"
import { parseOptions } from "./options"
import { ContextPanel } from "./panel"

/** V2 data and theme reads are reactive; the host disposes the panel with its slot. */
export const setup: Plugin.Definition["setup"] = (context) => {
  const config = parseOptions(context.options)
  return context.ui.slot({
    append: "sidebar.content",
    render: (props) => <ContextPanel context={context} sessionID={props.sessionID} config={config} />,
  })
}
