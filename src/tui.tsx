/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
const tui: TuiPlugin = async (api) => {
  api.slots.register({ order: 60, slots: { sidebar_content: () => <box /> } })
}
export default { id: "opencode-tui-context", tui } satisfies TuiPluginModule & { id: string }
