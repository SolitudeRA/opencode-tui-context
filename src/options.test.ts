import { expect, test } from "bun:test"
import type { PluginOptions_ } from "./types"
import { parseOptions } from "./options"

const defaults: Required<PluginOptions_> = { barWidth: 24, exclude: [], showLegend: true }

test("returns every default when options are undefined", () => {
  expect(parseOptions(undefined)).toEqual(defaults)
})

test("clamps a zero barWidth up to the minimum of 8", () => {
  expect(parseOptions({ barWidth: 0 }).barWidth).toBe(8)
})

test("falls back to 24 when barWidth is NaN", () => {
  expect(parseOptions({ barWidth: Number.NaN }).barWidth).toBe(24)
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

test("never throws on hostile input shapes and falls back to defaults", () => {
  const hostileInputs: readonly unknown[] = [
    { exclude: null },
    { barWidth: Number.POSITIVE_INFINITY },
    { barWidth: Number.NEGATIVE_INFINITY },
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
