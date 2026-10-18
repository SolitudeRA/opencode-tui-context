import type { TuiPlugin } from "@opencode-ai/plugin/tui"
import type { Plugin } from "@opencode/plugin/tui"

// Both hosts resolve ./tui, but call a different API. Keep this entry free of
// runtime imports so the other host's SDK and renderer are never loaded.
const tui: TuiPlugin = async (api, options, meta) => {
  const legacy = await import("./tui-v1.js")
  return legacy.default.tui(api, options, meta)
}

const setup: Plugin.Definition["setup"] = async (context) => {
  const modern = await import("./tui-v2.js")
  return modern.default.setup(context)
}

export default { id: "opencode-tui-context", tui, setup }
