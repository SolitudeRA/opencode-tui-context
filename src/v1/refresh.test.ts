import { expect, test } from "bun:test"
import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import { subscribeRefresh } from "./refresh"

function host() {
  const controller = new AbortController()
  const handlers = new Map<string, () => void>()
  const cleanups: Array<() => unknown> = []
  let unsubscribed = 0
  const api: Pick<TuiPluginApi, "event" | "lifecycle"> = {
    event: {
      on(type, handler) {
        const fire = () => handler({ type } as never)
        handlers.set(type, fire)
        return () => {
          handlers.delete(type)
          unsubscribed += 1
        }
      },
    },
    lifecycle: {
      signal: controller.signal,
      onDispose(cleanup) {
        cleanups.push(cleanup)
        return () => {}
      },
    },
  }
  return { api, controller, handlers, cleanups, unsubscribed: () => unsubscribed }
}

test("V1 refresh keeps the final event in a synchronous update burst", () => {
  const fixture = host()
  let latest = 0
  let observed = -1
  subscribeRefresh(fixture.api, () => { observed = latest })
  for (latest = 1; latest <= 20; latest += 1) fixture.handlers.get("message.updated")!()
  latest = 100
  fixture.handlers.get("session.idle")!()
  expect(observed).toBe(100)
  for (const event of ["message.removed", "message.part.updated", "message.part.removed", "session.updated", "session.compacted"]) {
    latest += 1
    fixture.handlers.get(event)!()
    expect(observed).toBe(latest)
  }
})

test("V1 cleanup unsubscribes all events and ignores a queued handler", () => {
  const fixture = host()
  let refreshes = 0
  subscribeRefresh(fixture.api, () => { refreshes += 1 })
  const queued = fixture.handlers.get("message.updated")!
  fixture.cleanups.forEach((cleanup) => cleanup())
  queued()
  fixture.cleanups.forEach((cleanup) => cleanup())
  expect(fixture.handlers.size).toBe(0)
  expect(fixture.unsubscribed()).toBe(7)
  expect(refreshes).toBe(0)
})

test("V1 abort prevents refreshes before lifecycle cleanup runs", () => {
  const fixture = host()
  let refreshes = 0
  subscribeRefresh(fixture.api, () => { refreshes += 1 })
  fixture.controller.abort()
  fixture.handlers.get("session.idle")!()
  expect(refreshes).toBe(0)
})

test("V1 does not subscribe after its lifecycle was aborted", () => {
  const fixture = host()
  fixture.controller.abort()
  subscribeRefresh(fixture.api, () => {})
  expect(fixture.handlers.size).toBe(0)
})
