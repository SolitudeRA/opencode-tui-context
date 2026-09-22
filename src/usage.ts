import { asRecord } from "./guards"
import type { Segment, SegmentId, TokenCounts, Usage, UsageLimits } from "./types"

export type AssistantUsage = {
  tokens: TokenCounts
  providerID?: string
  modelID?: string
}

/** Non-finite and non-positive values collapse to zero. */
function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : 0
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

export function tokensOf(message: unknown): TokenCounts {
  const tokens = asRecord(asRecord(message).tokens)
  const cache = asRecord(tokens.cache)
  return {
    input: count(tokens.input),
    output: count(tokens.output),
    reasoning: count(tokens.reasoning),
    cacheRead: count(cache.read),
    cacheWrite: count(cache.write),
  }
}

export function lastAssistantWithTokens(messages: readonly unknown[]): AssistantUsage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = asRecord(messages[index])
    if (message.role !== "assistant") continue
    // A message qualifies only when its own output tokens are greater than zero, never the total.
    const output = asRecord(message.tokens).output ?? 0
    const carriesOutput = typeof output === "number" && output > 0
    if (!carriesOutput) continue
    const providerID = optionalString(message.providerID)
    const modelID = optionalString(message.modelID)
    return {
      tokens: tokensOf(message),
      ...(providerID === undefined ? {} : { providerID }),
      ...(modelID === undefined ? {} : { modelID }),
    }
  }
  return undefined
}

export function computeUsage(input: {
  tokens: TokenCounts
  limits?: UsageLimits
  exclude?: SegmentId[]
}): Usage {
  const { input: inputTokens, output, reasoning, cacheRead, cacheWrite } = input.tokens
  const used = inputTokens + cacheRead + cacheWrite + reasoning + output
  const window = input.limits && input.limits.context > 0 ? input.limits.context : 0
  const reserved = input.limits && input.limits.output > 0 ? Math.max(0, input.limits.output - output) : 0
  const free = window > 0 ? Math.max(0, window - used - reserved) : 0
  const prompt = inputTokens + cacheWrite
  const exclude = input.exclude ?? []
  // Segment order is fixed; filtering happens here.
  const candidates: Segment[] = [
    { id: "cached", tokens: cacheRead },
    { id: "prompt", tokens: prompt },
    { id: "think", tokens: reasoning },
    { id: "out", tokens: output },
    { id: "reserved", tokens: reserved },
    { id: "free", tokens: free },
  ]
  return {
    used,
    window,
    percent: window > 0 ? Math.min(100, Math.round((used / window) * 100)) : 0,
    segments: candidates.filter((segment) => segment.tokens > 0 && !exclude.includes(segment.id)),
    known: window > 0,
  }
}
