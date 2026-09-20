import { expect, test } from "bun:test"
import type { Segment, SegmentId } from "./types"
import { formatBar, formatCompact, formatPercent, formatTokens } from "./format"

type Cells = ReadonlyArray<{ id: SegmentId; cells: number }>

function totalCells(result: Cells): number {
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

test("allocates the full width and keeps the free remainder when free is present", () => {
  const result = formatBar(mixedSegments, 20000, 32)
  expect(result.map((cell) => cell.id)).toEqual(["cached", "prompt", "free"])
  expect(result.find((cell) => cell.id === "free")?.cells).toBe(5)
  expect(totalCells(result)).toBe(32)
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
