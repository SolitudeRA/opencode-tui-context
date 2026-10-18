import { expect, test } from "bun:test"
import { lastAssistantWithTokens, modelLimits } from "./usage"

const first = {
  id: "msg_first",
  role: "assistant",
  providerID: "provider",
  modelID: "original",
  tokens: { input: 120, output: 20, reasoning: 3, cache: { read: 5, write: 7 } },
}
const expected = {
  tokens: { input: 120, output: 20, reasoning: 3, cacheRead: 5, cacheWrite: 7 },
  providerID: "provider",
  modelID: "original",
}

test("V1 selects flat model metadata and ignores V2-shaped messages", () => {
  expect(lastAssistantWithTokens([
    first,
    { type: "assistant", model: { providerID: "v2", id: "other" }, tokens: { output: 500 } },
    { role: "user", tokens: { output: 100 } },
  ])).toEqual(expected)
})

test("V1 selects the latest positive finite output without accepting totals", () => {
  expect(lastAssistantWithTokens([
    { ...first, tokens: { output: 1 } },
    first,
    ...[0, -1, Infinity, NaN, "20", undefined].map((output) => ({
      ...first, tokens: { output, total: 10000 },
    })),
  ])).toEqual(expected)
})

test("V1 excludes the revert boundary and everything after it", () => {
  const later = { ...first, id: "msg_later", tokens: { input: 999, output: 999 } }
  expect(lastAssistantWithTokens([first, later], "msg_later")).toEqual(expected)
  expect(lastAssistantWithTokens([first, later], "msg_first")).toBeUndefined()
  expect(lastAssistantWithTokens([first, later], "not-in-cache")).toBeUndefined()
})

const parent = { id: "msg_compact", role: "user" }
const summary = { ...first, id: "msg_summary", parentID: parent.id, summary: true, finish: "stop" }
const parts = (id: string) => id === parent.id ? [{ type: "compaction" }] : []

test("V1 clears the previous snapshot after a successful compaction", () => {
  expect(lastAssistantWithTokens([first, parent, summary], undefined, parts)).toBeUndefined()
  expect(lastAssistantWithTokens([first, parent, summary, { ...first, id: "msg_after" }], undefined, parts)).toEqual(expected)
})

test("V1 pending and failed summaries keep the previous conversation snapshot", () => {
  expect(lastAssistantWithTokens([first, parent, { ...summary, finish: undefined }], undefined, parts)).toEqual(expected)
  expect(lastAssistantWithTokens([first, parent, { ...summary, error: { name: "error" } }], undefined, parts)).toEqual(expected)
})

test("V1 summary counts never replace usage when the compaction parent is unavailable", () => {
  expect(lastAssistantWithTokens([first, summary], undefined, parts)).toEqual(expected)
  expect(lastAssistantWithTokens([first, parent, summary])).toEqual(expected)
})

test("V1 reverted compaction does not hide the earlier snapshot", () => {
  expect(lastAssistantWithTokens([first, parent, summary], parent.id, parts)).toEqual(expected)
})

test("V1 unknown or malformed message histories do not invent usage", () => {
  expect(lastAssistantWithTokens([null, [], "assistant", { role: "assistant" }])).toBeUndefined()
  expect(lastAssistantWithTokens([{ role: "assistant", tokens: { output: 2 }, providerID: 7 }])).toEqual({
    tokens: { input: 0, output: 2, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
  })
})

test("V1 limits belong to the snapshot's provider and model", () => {
  const providers = [
    { id: "other", models: { original: { limit: { context: 100, output: 10 } } } },
    { id: "provider", models: {
      original: { limit: { context: 10000, output: 1000 } },
      selected: { limit: { context: 20000, output: 2000 } },
    } },
  ]
  expect(modelLimits(providers, expected.providerID, expected.modelID)).toEqual({ context: 10000, output: 1000 })
  expect(modelLimits(providers, "unknown", "original")).toBeUndefined()
  expect(modelLimits(providers, "provider", "unknown")).toBeUndefined()
  expect(modelLimits(providers, undefined, "original")).toBeUndefined()
})
