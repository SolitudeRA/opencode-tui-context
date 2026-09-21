import { expect, test } from "bun:test"
import type { Segment, SegmentId } from "./types"
import {
  allocateCells,
  formatBar,
  formatCompositionBar,
  formatCompact,
  formatOverviewBar,
  formatPercent,
  formatTokens,
} from "./format"

type Cells<T extends string = SegmentId> = ReadonlyArray<{ id: T; cells: number }>

function totalCells<T extends string>(result: Cells<T>): number {
  return result.reduce((total, cell) => total + cell.cells, 0)
}

function isWellFormed(result: Cells): boolean {
  return result.every((cell) => Number.isFinite(cell.cells) && cell.cells > 0)
}

const mixedSegments: readonly Segment[] = [
  { id: "cached", tokens: 896 },
  { id: "prompt", tokens: 16469 },
  { id: "think", tokens: 12 },
  { id: "out", tokens: 101 },
  { id: "free", tokens: 2522 },
]

test("formats token counts with thousand separators", () => {
  expect(formatTokens(17357)).toBe("17,357")
  expect(formatTokens(0)).toBe("0")
})

test("formats token counts in compact notation with at most one fraction", () => {
  expect(formatCompact(17357)).toBe("17.4K")
  expect(formatCompact(999)).toBe("999")
})

test("formats percentages as bare integer strings", () => {
  expect(formatPercent(50)).toBe("50%")
  expect(formatPercent(0)).toBe("0%")
  expect(formatPercent(100)).toBe("100%")
})

test("allocates the full width, floors tiny segments, and keeps the free remainder", () => {
  const result = formatBar(mixedSegments, 20000, 32)
  expect(result.map((cell) => cell.id)).toEqual(["cached", "prompt", "think", "out", "free"])
  expect(result.find((cell) => cell.id === "think")?.cells).toBe(1)
  expect(result.find((cell) => cell.id === "out")?.cells).toBe(1)
  expect(result.find((cell) => cell.id === "free")?.cells).toBe(3)
  expect(totalCells(result)).toBe(32)
})

test("floors a positive segment that rounds to zero cells, borrowing from the widest", () => {
  const segments: readonly Segment[] = [
    { id: "cached", tokens: 9999 },
    { id: "think", tokens: 1 },
  ]
  const result = formatBar(segments, 10000, 32)
  expect(result.find((cell) => cell.id === "think")?.cells).toBe(1)
  expect(result.find((cell) => cell.id === "cached")?.cells).toBe(31)
  expect(totalCells(result)).toBe(32)
})

test("skips the visual floor when no cell can be spared", () => {
  const segments: readonly Segment[] = [
    { id: "cached", tokens: 1000 },
    { id: "think", tokens: 1 },
  ]
  const result = formatBar(segments, 1000, 1)
  expect(result).toEqual([{ id: "cached", cells: 1 }])
})

test("appends the tail as free when free is absent and not excluded", () => {
  const segments: readonly Segment[] = [
    { id: "cached", tokens: 8000 },
    { id: "prompt", tokens: 8000 },
  ]
  const result = formatBar(segments, 32000, 16)
  expect(result.at(-1)).toEqual({ id: "free", cells: 8 })
  expect(totalCells(result)).toBe(16)
})

test("omits the free tail when free is excluded", () => {
  const segments: readonly Segment[] = [
    { id: "cached", tokens: 8000 },
    { id: "prompt", tokens: 8000 },
  ]
  const result = formatBar(segments, 32000, 16, ["free"])
  expect(result.some((cell) => cell.id === "free")).toBe(false)
  expect(totalCells(result)).toBeLessThanOrEqual(16)
  expect(result.map((cell) => cell.id)).toEqual(["cached", "prompt"])
})

test("returns an empty bar for a zero width", () => {
  expect(formatBar(mixedSegments, 20000, 0)).toEqual([])
})

test("returns an empty bar for a zero window", () => {
  expect(formatBar(mixedSegments, 0, 32)).toEqual([])
})

test("returns an empty bar for a zero window even with all-zero segments", () => {
  const segments: readonly Segment[] = [
    { id: "cached", tokens: 0 },
    { id: "prompt", tokens: 0 },
  ]
  expect(formatBar(segments, 0, 32)).toEqual([])
})

test("skips zero-token segments without emitting NaN or negative cells", () => {
  const segments: readonly Segment[] = [
    { id: "cached", tokens: 0 },
    { id: "prompt", tokens: 0 },
    { id: "out", tokens: 0 },
  ]
  const result = formatBar(segments, 1000, 32)
  expect(isWellFormed(result)).toBe(true)
  expect(result).toEqual([{ id: "free", cells: 32 }])
})

test("clamps segments that exceed the window and never exceeds the width", () => {
  const segments: readonly Segment[] = [
    { id: "cached", tokens: 5_000_000 },
    { id: "prompt", tokens: 1000 },
  ]
  const result = formatBar(segments, 1000, 32)
  expect(isWellFormed(result)).toBe(true)
  expect(totalCells(result)).toBe(32)
  expect(result).toEqual([{ id: "cached", cells: 32 }])
})

test("ignores negative token counts without emitting negative cells", () => {
  const segments: readonly Segment[] = [
    { id: "cached", tokens: -5000 },
    { id: "prompt", tokens: 1000 },
  ]
  const result = formatBar(segments, 10000, 10)
  expect(isWellFormed(result)).toBe(true)
  expect(totalCells(result)).toBeLessThanOrEqual(10)
})

test("allocateCells gives each entry its proportional rounded share", () => {
  const entries: readonly { id: SegmentId; tokens: number }[] = [
    { id: "cached", tokens: 896 },
    { id: "prompt", tokens: 16_469 },
    { id: "think", tokens: 12 },
    { id: "out", tokens: 101 },
  ]
  const result = allocateCells(entries, 17_478, 32)
  expect(result.cells).toEqual([
    { id: "cached", cells: 2 },
    { id: "prompt", cells: 28 },
    { id: "think", cells: 1 },
    { id: "out", cells: 1 },
  ])
  expect(result.remaining).toBe(0)
  expect(totalCells(result.cells) + result.remaining).toBe(32)
})

test("allocateCells funds a floored segment from the leftover remainder first", () => {
  const entries: readonly { id: SegmentId; tokens: number }[] = [
    { id: "cached", tokens: 8000 },
    { id: "prompt", tokens: 8000 },
    { id: "think", tokens: 1 },
  ]
  const result = allocateCells(entries, 32_000, 32)
  expect(result.cells).toEqual([
    { id: "cached", cells: 8 },
    { id: "prompt", cells: 8 },
    { id: "think", cells: 1 },
  ])
  expect(result.remaining).toBe(15)
  expect(totalCells(result.cells) + result.remaining).toBe(32)
})

test("allocateCells borrows the floor from the widest segment when no remainder is left", () => {
  const entries: readonly { id: SegmentId; tokens: number }[] = [
    { id: "cached", tokens: 9999 },
    { id: "think", tokens: 1 },
  ]
  const result = allocateCells(entries, 10_000, 32)
  expect(result.cells).toEqual([
    { id: "cached", cells: 31 },
    { id: "think", cells: 1 },
  ])
  expect(result.remaining).toBe(0)
  expect(totalCells(result.cells) + result.remaining).toBe(32)
})

test("allocateCells returns nothing for a non-positive denominator or width", () => {
  expect(allocateCells(mixedSegments, 20_000, 0)).toEqual({ cells: [], remaining: 0 })
  expect(allocateCells(mixedSegments, 0, 32)).toEqual({ cells: [], remaining: 0 })
  expect(allocateCells(mixedSegments, 20_000, -4)).toEqual({ cells: [], remaining: 0 })
})

test("formatOverviewBar splits the window into used, reserved and the free remainder", () => {
  const result = formatOverviewBar(17_478, 100, 20_000, 32, [])
  expect(result).toEqual([
    { id: "used", cells: 28 },
    { id: "reserved", cells: 1 },
    { id: "free", cells: 3 },
  ])
  const free = result.find((cell) => cell.id === "free")
  // free takes the leftover cells (32 - 28 - 1), not round(free / window * width) = round(2422 / 20000 * 32) = 4.
  expect(free?.cells).toBe(3)
  expect(free?.cells).not.toBe(4)
  expect(totalCells(result)).toBe(32)
})

test("formatOverviewBar gives the whole remaining width to free when only used is positive", () => {
  const result = formatOverviewBar(17_478, 0, 20_000, 32, [])
  expect(result).toEqual([
    { id: "used", cells: 28 },
    { id: "free", cells: 4 },
  ])
  expect(totalCells(result)).toBe(32)
})

test("formatOverviewBar fills the width exactly when used and reserved round into it", () => {
  const result = formatOverviewBar(17_478, 2522, 20_000, 32, [])
  expect(result).toEqual([
    { id: "used", cells: 28 },
    { id: "reserved", cells: 4 },
  ])
  expect(result.some((cell) => cell.id === "free")).toBe(false)
  expect(totalCells(result)).toBe(32)
})

test("formatOverviewBar omits free when it is excluded", () => {
  const result = formatOverviewBar(17_478, 100, 20_000, 32, ["free"])
  expect(result).toEqual([
    { id: "used", cells: 28 },
    { id: "reserved", cells: 1 },
  ])
  expect(result.some((cell) => cell.id === "free")).toBe(false)
  expect(totalCells(result)).toBeLessThanOrEqual(32)
})

test("formatOverviewBar returns an empty bar for a non-positive window or width", () => {
  expect(formatOverviewBar(17_478, 2522, 0, 32, [])).toEqual([])
  expect(formatOverviewBar(17_478, 2522, 20_000, 0, [])).toEqual([])
  expect(formatOverviewBar(17_478, 2522, 20_000, -4, [])).toEqual([])
})

test("formatCompositionBar allocates against used with floors borrowed from the widest", () => {
  const result = formatCompositionBar(mixedSegments, 17_478, 32, [])
  expect(result).toEqual([
    { id: "cached", cells: 2 },
    { id: "prompt", cells: 28 },
    { id: "think", cells: 1 },
    { id: "out", cells: 1 },
  ])
  expect(totalCells(result)).toBe(32)
})

test("formatCompositionBar keeps only the four composition ids in input order", () => {
  const segments: readonly Segment[] = [
    { id: "prompt", tokens: 600 },
    { id: "reserved", tokens: 250 },
    { id: "cached", tokens: 300 },
    { id: "think", tokens: 0 },
    { id: "free", tokens: 1000 },
    { id: "out", tokens: 100 },
  ]
  const result = formatCompositionBar(segments, 1000, 32, [])
  const compositionIds: readonly SegmentId[] = ["cached", "prompt", "think", "out"]
  expect(result).toEqual([
    { id: "prompt", cells: 19 },
    { id: "cached", cells: 10 },
    { id: "out", cells: 3 },
  ])
  expect(result.every((cell) => compositionIds.includes(cell.id))).toBe(true)
  expect(result.some((cell) => cell.id === "free" || cell.id === "reserved")).toBe(false)
})

test("formatCompositionBar drops excluded segments", () => {
  const result = formatCompositionBar(mixedSegments, 17_478, 32, ["prompt"])
  expect(result).toEqual([
    { id: "cached", cells: 2 },
    { id: "think", cells: 1 },
    { id: "out", cells: 1 },
  ])
  expect(result.some((cell) => cell.id === "prompt")).toBe(false)
})

test("formatCompositionBar returns an empty bar for a non-positive used or width", () => {
  expect(formatCompositionBar(mixedSegments, 0, 32, [])).toEqual([])
  expect(formatCompositionBar(mixedSegments, 17_478, 0, [])).toEqual([])
  expect(formatCompositionBar(mixedSegments, 17_478, -3, [])).toEqual([])
})
