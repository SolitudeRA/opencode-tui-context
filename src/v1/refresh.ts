import type { TuiPluginApi } from "@opencode-ai/plugin/tui"

const EVENTS = [
  "message.updated",
  "message.removed",
  "message.part.updated",
  "message.part.removed",
  "session.updated",
  "session.idle",
  "session.compacted",
] as const

/** Every state event invalidates the snapshot; the renderer coalesces frame requests. */
export function subscribeRefresh(
  api: Pick<TuiPluginApi, "event" | "lifecycle">,
  refresh: () => void,
): void {
  const unsubs: Array<() => void> = []
  let active = !api.lifecycle.signal.aborted
  const dispose = () => {
    active = false
    for (const unsubscribe of unsubs.splice(0)) unsubscribe()
  }
  api.lifecycle.onDispose(dispose)
  if (!active) return
  for (const event of EVENTS) {
    unsubs.push(api.event.on(event, () => {
      if (active && !api.lifecycle.signal.aborted) refresh()
    }))
  }
}
