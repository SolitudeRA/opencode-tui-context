import { asRecord } from "./guards"
import type { PluginOptions_, SegmentId } from "./types"

const DEFAULT_BAR_WIDTH = 24
const MIN_BAR_WIDTH = 8
const MAX_BAR_WIDTH = 120

const SEGMENT_IDS: readonly SegmentId[] = ["cached", "prompt", "think", "out", "reserved", "free"]

function isSegmentId(value: unknown): value is SegmentId {
  return typeof value === "string" && SEGMENT_IDS.some((id) => id === value)
}

function parseBarWidth(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_BAR_WIDTH
  return Math.min(MAX_BAR_WIDTH, Math.max(MIN_BAR_WIDTH, Math.round(value)))
}

function parseExclude(value: unknown): SegmentId[] {
  if (!Array.isArray(value)) return []
  const result: SegmentId[] = []
  for (const entry of value) {
    if (isSegmentId(entry) && !result.includes(entry)) result.push(entry)
  }
  return result
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

/** Normalizes raw user config into fully-resolved options; never throws on any input shape. */
export function parseOptions(raw: unknown): Required<PluginOptions_> {
  const options = asRecord(raw)
  return {
    barWidth: parseBarWidth(options.barWidth),
    exclude: parseExclude(options.exclude),
    showLegend: parseBoolean(options.showLegend, true),
  }
}
