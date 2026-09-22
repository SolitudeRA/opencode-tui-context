import type { TuiPlugin } from "@opencode-ai/plugin/tui"
import { createEffect, createSignal } from "solid-js"
import { parseOptions } from "./options"
import { renderPanel, setPanelWidth, syncPanelWidth } from "./panel"

// Minimum spacing between two repaints; the throttle below drops any event landing inside this window.
const REPAINT_INTERVAL_MS = 50
const SLOT_ORDER = 60

/** Wires the sidebar panel into the host: theme, session events, repaint throttle and slot registration. */
export const tui: TuiPlugin = async (api, options) => {
  const config = parseOptions(options)
  // `barWidth` is only the pre-measurement starting width; the box measurement replaces it.
  setPanelWidth(config.barWidth)
  // The tick signal is the repaint trigger: reading it in the slot body subscribes this panel to
  // the throttled refresh wired below to the session event bus.
  const [tick, setTick] = createSignal(0)

  // `onSizeChange` alone can miss (re)mount cycles, so resync from the live box after every
  // repaint; `tick` is this bundle's rebuild trigger.
  createEffect(() => {
    tick()
    syncPanelWidth()
  })

  const repaint = () => {
    // The signal bump re-runs the slot body (this bundle has no fine-grained reactivity);
    // requestRender() draws the resulting frame.
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
}
