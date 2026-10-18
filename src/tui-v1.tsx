import type { TuiPluginModule } from "@opencode-ai/plugin/tui"
import { tui } from "./v1/plugin"

export default { id: "opencode-tui-context", tui } satisfies TuiPluginModule
