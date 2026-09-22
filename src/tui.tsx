import type { TuiPluginModule } from "@opencode-ai/plugin/tui"
import { tui } from "./plugin"

const plugin = { id: "opencode-tui-context", tui }

export default plugin satisfies TuiPluginModule & { id: string }
