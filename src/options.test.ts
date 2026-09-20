import { expect, test } from "bun:test"
import type { PluginOptions_ } from "./types"
import { parseOptions } from "./options"

const defaults: Required<PluginOptions_> = { barWidth: 32, exclude: [], showCost: true, showLegend: true }

test("returns every default when options are undefined", () => {
  expect(parseOptions(undefined)).toEqual(defaults)
})

test("clamps a zero barWidth up to the minimum of 8", () => {
  expect(parseOptions({ barWidth: 0 }).barWidth).toBe(8)
})

test("falls back to 32 when barWidth is NaN", () => {
  expect(parseOptions({ barWidth: Number.NaN }).barWidth).toBe(32)
})

test("clamps an oversized barWidth down to the maximum of 120", () => {
  expect(parseOptions({ barWidth: 999 }).barWidth).toBe(120)
})

test("keeps only valid, de-duplicated segment ids in first-seen order", () => {
  expect(parseOptions({ exclude: ["free", "free", "bogus"] }).exclude).toEqual(["free"])
})

test("falls back to an empty exclude list when it is not an array", () => {
  expect(parseOptions({ exclude: "free" }).exclude).toEqual([])
})

test("falls back to true when showCost is not a boolean", () => {
  expect(parseOptions({ showCost: "yes" }).showCost).toBe(true)
})

test("never throws on hostile input shapes and falls back to defaults", () => {
  const hostileInputs: readonly unknown[] = [
    { exclude: null },
    { barWidth: Number.POSITIVE_INFINITY },
    { barWidth: Number.NEGATIVE_INFINITY },
    { showCost: null },
    [],
    "string",
    0,
    null,
  ]
  for (const input of hostileInputs) {
    expect(() => parseOptions(input)).not.toThrow()
    expect(parseOptions(input)).toEqual(defaults)
  }
})
