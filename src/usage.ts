import type { Segment, SegmentId, TokenCounts, Usage, UsageLimits } from "./types"

export type AssistantUsage = {
  tokens: TokenCounts
  providerID?: string
  modelID?: string
  cost?: number
}

/** Mirrors the baseline `record()` helper: only plain objects are usable as records. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

/** Mirrors the baseline `num()` helper: non-finite and non-positive values collapse to zero. */
function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : 0
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined
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
    // Baseline tui.js:277 selects on `(m.tokens?.output ?? 0) > 0` — output tokens only, never the total.
    const output = asRecord(message.tokens).output ?? 0
    const carriesOutput = typeof output === "number" && output > 0
    if (!carriesOutput) continue
    const providerID = optionalString(message.providerID)
    const modelID = optionalString(message.modelID)
    const cost = optionalNumber(message.cost)
    return {
      tokens: tokensOf(message),
      ...(providerID === undefined ? {} : { providerID }),
      ...(modelID === undefined ? {} : { modelID }),
      ...(cost === undefined ? {} : { cost }),
    }
  }
  return undefined
}

export function computeUsage(input: {
  tokens: TokenCounts
  limits?: UsageLimits
  cost?: number
  exclude?: SegmentId[]
}): Usage {
  const { input: inputTokens, output, reasoning, cacheRead, cacheWrite } = input.tokens
  const used = inputTokens + cacheRead + cacheWrite + reasoning + output
  const window = input.limits && input.limits.context > 0 ? input.limits.context : 0
  const reserved = input.limits && input.limits.output > 0 ? Math.max(0, input.limits.output - output) : 0
  const free = window > 0 ? Math.max(0, window - used - reserved) : 0
  const prompt = inputTokens + cacheWrite
  const exclude = input.exclude ?? []
  // Segment order is fixed by the baseline (tui.js:42-49); filtering happens here (tui.js:54).
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
    cost: input.cost ?? 0,
    segments: candidates.filter((segment) => segment.tokens > 0 && !exclude.includes(segment.id)),
    known: window > 0,
  }
}
