import { asRecord } from "../guards"
import type { UsageLimits } from "../types"
import { tokensOf, type AssistantUsage } from "../usage"

type Parts = (messageID: string) => readonly unknown[]

/** V1 compaction is a summary assistant whose parent contains a compaction part. */
function completedCompaction(message: Record<string, unknown>, messages: readonly unknown[], parts: Parts): boolean {
  if (message.summary !== true || !message.finish || message.error) return false
  if (typeof message.parentID !== "string") return false
  const parent = messages.find((item) => asRecord(item).id === message.parentID)
  return asRecord(parent).role === "user" && parts(message.parentID).some((part) => asRecord(part).type === "compaction")
}

/** Reads V1's flat model reference and excludes reverted or compacted history. */
export function lastAssistantWithTokens(
  messages: readonly unknown[],
  revertMessageID?: string,
  parts: Parts = () => [],
): AssistantUsage | undefined {
  const end = revertMessageID === undefined
    ? messages.length
    : messages.findIndex((message) => asRecord(message).id === revertMessageID)
  // Incomplete history cannot establish which messages are still active.
  if (end < 0) return undefined

  for (let index = end - 1; index >= 0; index -= 1) {
    const message = asRecord(messages[index])
    if (message.role !== "assistant") continue
    if (message.summary === true) {
      if (completedCompaction(message, messages, parts)) return undefined
      // A summary request's counts are never a normal conversation snapshot.
      continue
    }
    const output = asRecord(message.tokens).output
    if (typeof output !== "number" || !Number.isFinite(output) || output <= 0) continue
    return {
      tokens: tokensOf(message),
      ...(typeof message.providerID === "string" ? { providerID: message.providerID } : {}),
      ...(typeof message.modelID === "string" ? { modelID: message.modelID } : {}),
    }
  }
  return undefined
}

/** Provider/model selection follows the message that produced the snapshot. */
export function modelLimits(
  providers: readonly { id: string; models: Record<string, { limit: UsageLimits }> }[],
  providerID: string | undefined,
  modelID: string | undefined,
): UsageLimits | undefined {
  if (providerID === undefined || modelID === undefined) return undefined
  const model = providers.find((provider) => provider.id === providerID)?.models[modelID]
  if (model === undefined) return undefined
  return { context: model.limit.context, output: model.limit.output }
}
