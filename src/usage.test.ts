import { expect, test } from "bun:test"
import type { TokenCounts, Usage } from "./types"
import { computeUsage, lastAssistantWithTokens, tokensOf } from "./usage"

const zeroCounts: TokenCounts = { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 }

const realCounts: TokenCounts = { input: 16348, output: 101, reasoning: 12, cacheRead: 896, cacheWrite: 0 }

const realMessage = {
  role: "assistant",
  tokens: { total: 17357, input: 16348, output: 101, reasoning: 12, cache: { write: 0, read: 896 } },
  cost: 0.002522688,
  modelID: "deepseek-flash",
  providerID: "deepseek",
}

test("reports unknown usage when no assistant message carries output tokens", () => {
  const messages: readonly unknown[] = [
    { role: "user", tokens: { input: 120, output: 0 } },
    { role: "assistant", tokens: { input: 40, output: 0 } },
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
    role: "assistant",
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
    role: "assistant",
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
      { role: "assistant", tokens: { input: 999, output: 0 } },
      realMessage,
      { role: "user", tokens: { input: 10, output: 5 } },
    ]),
  ).toEqual({ tokens: realCounts, providerID: "deepseek", modelID: "deepseek-flash", cost: 0.002522688 })
  const usage: Usage = computeUsage({ tokens: counts, cost: realMessage.cost })
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
