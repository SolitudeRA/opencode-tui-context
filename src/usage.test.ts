import { expect, test } from "bun:test"
import type { TokenCounts, Usage } from "./types"
import { computeUsage, lastAssistantWithTokens, tokensOf } from "./usage"

const zeroCounts: TokenCounts = { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 }

const realCounts: TokenCounts = { input: 16348, output: 101, reasoning: 12, cacheRead: 896, cacheWrite: 0 }

const realMessage = {
  id: "msg_002",
  type: "assistant",
  tokens: { total: 17357, input: 16348, output: 101, reasoning: 12, cache: { write: 0, read: 896 } },
  model: { id: "deepseek-flash", providerID: "deepseek" },
}

test("reports unknown usage when no assistant message carries output tokens", () => {
  const messages: readonly unknown[] = [
    { type: "user", tokens: { input: 120, output: 0 } },
    { type: "assistant", tokens: { input: 40, output: 0 } },
  ]
  expect(lastAssistantWithTokens(messages)).toBeUndefined()
  const usage: Usage = computeUsage({ tokens: zeroCounts })
  expect(usage.used).toBe(0)
  expect(usage.percent).toBe(0)
  expect(usage.known).toBe(false)
  expect(usage.segments).toEqual([])
})

test("keeps usage unknown with a zero window when limits are missing", () => {
  const usage: Usage = computeUsage({ tokens: realCounts })
  expect(usage.known).toBe(false)
  expect(usage.window).toBe(0)
  expect(usage.percent).toBe(0)
  expect(usage.segments.map((segment) => segment.id)).not.toContain("free")
})

test("sums input, reasoning and output when cache counts are zero", () => {
  const counts: TokenCounts = tokensOf({
    type: "assistant",
    tokens: { total: 300, input: 200, output: 60, reasoning: 40 },
  })
  expect(counts).toEqual({ input: 200, output: 60, reasoning: 40, cacheRead: 0, cacheWrite: 0 })
  const usage: Usage = computeUsage({ tokens: counts })
  expect(usage.used).toBe(300)
})

test("clamps percent to 100 and drops free when used exceeds the window", () => {
  const usage: Usage = computeUsage({
    tokens: { input: 5000, output: 100, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
    limits: { context: 4000, output: 0 },
  })
  expect(usage.used).toBe(5100)
  expect(usage.percent).toBe(100)
  const free = usage.segments.find((segment) => segment.id === "free")
  expect(free?.tokens ?? 0).toBe(0)
})

test("coerces negative, NaN and non-finite counts to zero without throwing", () => {
  const counts: TokenCounts = tokensOf({
    type: "assistant",
    tokens: {
      total: Number.NaN,
      input: -50,
      output: Number.POSITIVE_INFINITY,
      reasoning: Number.NaN,
      cache: { read: -1, write: Number.NEGATIVE_INFINITY },
    },
  })
  expect(counts).toEqual(zeroCounts)
  const usage: Usage = computeUsage({ tokens: counts })
  expect(usage.used).toBe(0)
})

test("produces no reserved segment when the output limit does not exceed output", () => {
  const usage: Usage = computeUsage({
    tokens: { input: 1000, output: 500, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
    limits: { context: 8000, output: 500 },
  })
  expect(usage.segments.some((segment) => segment.id === "reserved")).toBe(false)
  expect(usage.used).toBe(1500)
})

test("computes the exact used total for the real deepseek sample", () => {
  const counts: TokenCounts = tokensOf(realMessage)
  expect(counts).toEqual(realCounts)
  expect(
    lastAssistantWithTokens([
      { type: "assistant", tokens: { input: 999, output: 0 } },
      realMessage,
      { type: "user", tokens: { input: 10, output: 5 } },
    ]),
  ).toEqual({ tokens: realCounts, providerID: "deepseek", modelID: "deepseek-flash" })
  const usage: Usage = computeUsage({ tokens: counts })
  expect(usage.used).toBe(16348 + 896 + 0 + 12 + 101)
  expect(usage.used).toBe(17357)
})

test("removes the excluded free segment while keeping the others", () => {
  const usage: Usage = computeUsage({
    tokens: { input: 2000, output: 100, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
    limits: { context: 8000, output: 200 },
    exclude: ["free"],
  })
  const ids = usage.segments.map((segment) => segment.id)
  expect(ids).not.toContain("free")
  expect(ids).toContain("out")
  expect(usage.used).toBe(2100)
})

test("selects the latest V2 assistant with positive output and its own model reference", () => {
  const later = {
    ...realMessage,
    id: "msg_003",
    tokens: { input: 200, output: 20, reasoning: 3, cache: { read: 5, write: 7 } },
    model: { providerID: "other-provider", id: "other-model", variant: "high" },
    providerID: "ignored-legacy-provider",
    modelID: "ignored-legacy-model",
  }
  expect(lastAssistantWithTokens([
    realMessage,
    later,
    { type: "assistant", tokens: { input: 999, output: 0 } },
    { type: "model-switched", model: { providerID: "selected-provider", id: "selected-model" } },
  ])).toEqual({
    tokens: { input: 200, output: 20, reasoning: 3, cacheRead: 5, cacheWrite: 7 },
    providerID: "other-provider",
    modelID: "other-model",
  })
})

test("ignores legacy role-only messages and malformed or non-finite output data", () => {
  const invalidMessages: unknown[] = [
    null,
    undefined,
    [],
    "assistant",
    { role: "assistant", tokens: { output: 50 } },
    { type: "user", tokens: { output: 50 } },
    ...[undefined, null, [], {}, { output: 0 }, { output: -1 }, { output: "2" },
      { output: Number.NaN }, { output: Number.POSITIVE_INFINITY }, { total: 20, input: 20 }]
      .map((tokens) => ({ type: "assistant", tokens })),
  ]
  expect(lastAssistantWithTokens(invalidMessages)).toBeUndefined()
  expect(lastAssistantWithTokens([realMessage, ...invalidMessages])).toEqual({
    tokens: realCounts,
    providerID: "deepseek",
    modelID: "deepseek-flash",
  })
})

test("keeps usage when a model reference is absent or malformed without guessing legacy IDs", () => {
  for (const model of [undefined, null, [], "deepseek/flash", { providerID: 1, id: false }]) {
    expect(lastAssistantWithTokens([{
      ...realMessage,
      model,
      providerID: "legacy-provider",
      modelID: "legacy-model",
    }])).toEqual({ tokens: realCounts })
  }
  expect(lastAssistantWithTokens([{ ...realMessage, model: { providerID: "deepseek" } }])).toEqual({
    tokens: realCounts,
    providerID: "deepseek",
  })
})

test("revert excludes the boundary message and every later message", () => {
  const reverted = { ...realMessage, id: "msg_003", tokens: { output: 500 } }
  const messages = [realMessage, reverted, { ...reverted, id: "msg_004" }]
  expect(lastAssistantWithTokens(messages, "msg_003")).toEqual({
    tokens: realCounts,
    providerID: "deepseek",
    modelID: "deepseek-flash",
  })
  expect(lastAssistantWithTokens(messages, "msg_002")).toBeUndefined()
})

test("an unavailable revert boundary never falls back to potentially reverted messages", () => {
  expect(lastAssistantWithTokens([realMessage], "msg_not_loaded")).toBeUndefined()
  expect(lastAssistantWithTokens([], "msg_not_loaded")).toBeUndefined()
})

test("completed compaction clears the previous snapshot until a new assistant reports output", () => {
  const compaction = { id: "msg_003", type: "compaction", status: "completed", tokens: { output: 900 } }
  expect(lastAssistantWithTokens([realMessage, compaction])).toBeUndefined()
  expect(lastAssistantWithTokens([
    realMessage,
    compaction,
    { type: "assistant", tokens: { input: 100, output: 0 } },
  ])).toBeUndefined()
  expect(lastAssistantWithTokens([
    realMessage,
    compaction,
    { ...realMessage, id: "msg_004", tokens: { input: 80, output: 5 } },
  ])).toEqual({
    tokens: { ...zeroCounts, input: 80, output: 5 },
    providerID: "deepseek",
    modelID: "deepseek-flash",
  })
})

test("running or failed compaction preserves the previous assistant snapshot", () => {
  for (const status of ["running", "failed"]) {
    expect(lastAssistantWithTokens([
      realMessage,
      { type: "compaction", status, tokens: { output: 900 } },
    ])).toEqual({ tokens: realCounts, providerID: "deepseek", modelID: "deepseek-flash" })
  }
})

test("compaction at or after the revert boundary does not erase the restored snapshot", () => {
  const compaction = { id: "msg_003", type: "compaction", status: "completed" }
  const messages = [realMessage, compaction, { id: "msg_004", type: "user" }]
  expect(lastAssistantWithTokens(messages, "msg_003")).toEqual({
    tokens: realCounts,
    providerID: "deepseek",
    modelID: "deepseek-flash",
  })
  expect(lastAssistantWithTokens(messages, "msg_004")).toBeUndefined()
})
