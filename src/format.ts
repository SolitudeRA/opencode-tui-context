import type { Segment, SegmentId } from "./types"

// Baseline formatters (tui.js:181-183): plain integer and compact number formats.
const tokenFmt = new Intl.NumberFormat("en-US")
const compactFmt = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 })
// Deliberate baseline deviation: 4 decimals instead of the baseline's default 2, because real
// session costs such as 0.002522688 would render as "$0.00" and hide the usage entirely.
const costFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
})

export function formatTokens(n: number): string {
  return tokenFmt.format(n)
}

export function formatCompact(n: number): string {
  return compactFmt.format(n)
}

export function formatPercent(n: number): string {
  return `${n}%`
}

export function formatCost(usd: number): string {
  return costFmt.format(usd)
}

/**
 * Allocates bar cells per segment, mirroring the baseline `segmentBar` (tui.js:132-144):
 * each non-free segment takes `round(tokens / window * width)` cells, capped by what is left;
 * the remainder becomes a trailing `free` cell unless `free` is excluded.
 */
export function formatBar(
  segments: readonly Segment[],
  window: number,
  width: number,
  exclude: readonly SegmentId[] = [],
): Array<{ id: SegmentId; cells: number }> {
  if (width <= 0 || window <= 0) return []
  const out: Array<{ id: SegmentId; cells: number }> = []
  let remaining = width
  for (const segment of segments) {
    if (segment.id === "free") continue
    const cells = Math.min(remaining, Math.round((segment.tokens / window) * width))
    // Guard: NaN/zero/negative cells must neither be emitted nor poison `remaining`.
    if (!Number.isFinite(cells) || cells <= 0) continue
    out.push({ id: segment.id, cells })
    remaining -= cells
  }
  if (remaining > 0 && !exclude.includes("free")) out.push({ id: "free", cells: remaining })
  return out
}
