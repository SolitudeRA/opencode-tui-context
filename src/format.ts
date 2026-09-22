import type { OverviewSegmentId, Segment, SegmentId } from "./types"

// Compact number format for token counts, mirroring the abbreviated counts shown by the built-in
// sidebar panel shipped with opencode.
const compactFmt = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 })

export function formatCompact(n: number): string {
  return compactFmt.format(n)
}

export function formatPercent(n: number): string {
  return `${n}%`
}

// Cell accounting shared by the bar allocators: natural = round(tokens / denominator * width) before clamping.
type CellPlan<T extends string> = { id: T; tokens: number; natural: number; cells: number }

const COMPOSITION_IDS: readonly SegmentId[] = ["cached", "prompt", "think", "out"]

/**
 * Distributes `width` cells across `entries` in order, mirroring the segment bar drawn by the
 * built-in sidebar panel shipped with opencode: each entry takes
 * `round(tokens / denominator * width)` cells, capped by what is left. Callers pre-filter their
 * entries.
 *
 * Visual floor: a positive entry that rounds to zero cells still receives one cell so it never
 * silently drops out of the bar (and therefore the legend). A floor is paid from the remaining cells
 * first, otherwise borrowed from the widest entry; when neither can spare a cell the floor is
 * skipped. The total never exceeds `width`.
 *
 * Returns only the entries that received cells, in their original order, plus the unallocated count.
 * Guarantees `sum(cells) + remaining === width`.
 */
export function allocateCells<T extends string>(
  entries: readonly { id: T; tokens: number }[],
  denominator: number,
  width: number,
): { cells: Array<{ id: T; cells: number }>; remaining: number } {
  if (width <= 0 || denominator <= 0) return { cells: [], remaining: 0 }
  const planned: Array<CellPlan<T>> = []
  let remaining = width
  for (const entry of entries) {
    const natural = Math.max(0, Math.round((entry.tokens / denominator) * width))
    const cells = Math.min(remaining, natural)
    remaining -= cells
    planned.push({ id: entry.id, tokens: entry.tokens, natural, cells })
  }
  for (const entry of planned) {
    if (entry.cells > 0 || entry.natural > 0) continue
    if (!(entry.tokens > 0)) continue
    if (remaining > 0) {
      entry.cells = 1
      remaining -= 1
      continue
    }
    let donor: CellPlan<T> | undefined
    for (const candidate of planned) {
      if (candidate.cells > 1 && (donor === undefined || candidate.cells > donor.cells)) donor = candidate
    }
    if (donor === undefined) break
    donor.cells -= 1
    entry.cells = 1
  }
  return {
    cells: planned.filter((entry) => entry.cells > 0).map((entry) => ({ id: entry.id, cells: entry.cells })),
    remaining,
  }
}

/**
 * Allocates the overview bar: `used` and `reserved` against `window`, with `free` taking the
 * remaining cells (never `round(free / window * width)`) so the three parts sum to exactly `width`.
 */
export function formatOverviewBar(
  used: number,
  reserved: number,
  window: number,
  width: number,
  exclude: readonly SegmentId[],
): Array<{ id: OverviewSegmentId; cells: number }> {
  if (width <= 0 || window <= 0) return []
  const entries: Array<{ id: OverviewSegmentId; tokens: number }> = [
    { id: "used", tokens: used },
    { id: "reserved", tokens: reserved },
  ]
  const { cells, remaining } = allocateCells(entries, window, width)
  if (remaining > 0 && !exclude.includes("free")) cells.push({ id: "free", cells: remaining })
  return cells
}

/**
 * Allocates the composition bar: only `cached`, `prompt`, `think` and `out` segments with positive
 * tokens, against `used`. No `free` tail is appended, so rounding slack may leave 0-2 trailing cells.
 */
export function formatCompositionBar(
  segments: readonly Segment[],
  used: number,
  width: number,
  exclude: readonly SegmentId[],
): Array<{ id: SegmentId; cells: number }> {
  if (width <= 0 || used <= 0) return []
  const filtered: Array<{ id: SegmentId; tokens: number }> = []
  for (const segment of segments) {
    if (!COMPOSITION_IDS.includes(segment.id)) continue
    if (!(segment.tokens > 0)) continue
    if (exclude.includes(segment.id)) continue
    filtered.push({ id: segment.id, tokens: segment.tokens })
  }
  return allocateCells(filtered, used, width).cells
}
