import { describe, expect, test } from "bun:test"
import { RGBA, rgbToHex } from "@opentui/core"
import {
  compositionBarEntries,
  compositionLegendItems,
  effectiveWidth,
  legendRung,
  overviewBarEntries,
  overviewLegendItems,
  overviewToken,
  segmentColor,
  setPanelWidth,
  titleRung,
  type LegendRung,
  type ResolvedOptions,
  type Theme,
  type TitleRung,
} from "./panel"
import type { Usage } from "./types"

const config: ResolvedOptions = { barWidth: 24, showLegend: true, exclude: [] }

// 17478 used + 100 reserved + 2422 free = the 20000-token window; 17478 / 20000 rounds to 87%.
const overviewUsage: Usage = {
  used: 17478,
  window: 20000,
  percent: 87,
  known: true,
  segments: [
    { id: "reserved", tokens: 100 },
    { id: "free", tokens: 2422 },
  ],
}

// 16348 cached + 896 prompt + 133 think + 101 out = 17478 used.
const compositionUsage: Usage = {
  used: 17478,
  window: 20000,
  percent: 87,
  known: true,
  segments: [
    { id: "cached", tokens: 16348 },
    { id: "prompt", tokens: 896 },
    { id: "think", tokens: 133 },
    { id: "out", tokens: 101 },
  ],
}

// Hands every colour token its own obviously-fake value, so an assertion against one token cannot be
// satisfied by a different token the implementation might look up instead. Every field is required, so
// a new or renamed theme token breaks this builder at compile time. `thinkingOpacity` is the only
// non-colour member.
function sentinelTheme(): Theme {
  let index = 0
  const token = (): RGBA => {
    index += 1
    return RGBA.fromHex(`#${index.toString(16).padStart(6, "0")}`)
  }
  return {
    primary: token(), secondary: token(), accent: token(), error: token(), warning: token(), success: token(), info: token(),
    text: token(), textMuted: token(), selectedListItemText: token(),
    background: token(), backgroundPanel: token(), backgroundElement: token(), backgroundMenu: token(),
    border: token(), borderActive: token(), borderSubtle: token(),
    diffAdded: token(), diffRemoved: token(), diffContext: token(), diffHunkHeader: token(),
    diffHighlightAdded: token(), diffHighlightRemoved: token(),
    diffAddedBg: token(), diffRemovedBg: token(), diffContextBg: token(), diffLineNumber: token(),
    diffAddedLineNumberBg: token(), diffRemovedLineNumberBg: token(),
    markdownText: token(), markdownHeading: token(), markdownLink: token(), markdownLinkText: token(),
    markdownCode: token(), markdownBlockQuote: token(), markdownEmph: token(), markdownStrong: token(),
    markdownHorizontalRule: token(), markdownListItem: token(), markdownListEnumeration: token(),
    markdownImage: token(), markdownImageText: token(), markdownCodeBlock: token(),
    syntaxComment: token(), syntaxKeyword: token(), syntaxFunction: token(), syntaxVariable: token(),
    syntaxString: token(), syntaxNumber: token(), syntaxType: token(), syntaxOperator: token(), syntaxPunctuation: token(),
    thinkingOpacity: 1,
  }
}

const theme = sentinelTheme()

describe("overviewToken", () => {
  test("maps used to the primary theme token", () => {
    expect(overviewToken("used")).toBe("primary")
  })

  test("maps reserved to the textMuted theme token", () => {
    expect(overviewToken("reserved")).toBe("textMuted")
  })

  test("maps free to the text theme token", () => {
    expect(overviewToken("free")).toBe("text")
  })
})

describe("segmentColor", () => {
  test("resolves cached, prompt and think through the success, accent and secondary tokens", () => {
    expect(segmentColor("cached", theme)).toBe(theme.success)
    expect(segmentColor("prompt", theme)).toBe(theme.accent)
    expect(segmentColor("think", theme)).toBe(theme.secondary)
  })

  test("resolves reserved and free through the textMuted and text tokens", () => {
    expect(segmentColor("reserved", theme)).toBe(theme.textMuted)
    expect(segmentColor("free", theme)).toBe(theme.text)
  })

  test("returns the hardcoded bright yellow for out, independent of the theme", () => {
    const out = segmentColor("out", theme)
    expect(out.toInts()).toEqual([255, 255, 0, 255])
    expect(rgbToHex(out)).toBe("#ffff00")
    expect(out.equals(theme.warning)).toBe(false)
  })
})

describe("overviewBarEntries", () => {
  test("splits a 32-cell bar into used 28, reserved 1 and free 3", () => {
    expect(overviewBarEntries(overviewUsage, config, 32)).toEqual([
      { id: "used", cells: 28 },
      { id: "reserved", cells: 1 },
      { id: "free", cells: 3 },
    ])
  })

  test("treats a missing reserved segment as zero tokens", () => {
    const entries = overviewBarEntries({ ...overviewUsage, segments: [] }, config, 32)
    expect(entries).toEqual([
      { id: "used", cells: 28 },
      { id: "free", cells: 4 },
    ])
    expect(entries.some((entry) => entry.id === "reserved")).toBe(false)
  })

  test("drops the free tail when free is excluded", () => {
    expect(overviewBarEntries(overviewUsage, { ...config, exclude: ["free"] }, 32)).toEqual([
      { id: "used", cells: 28 },
      { id: "reserved", cells: 1 },
    ])
  })
})

describe("compositionBarEntries", () => {
  test("returns no cells when the bar width is zero", () => {
    expect(compositionBarEntries(compositionUsage, config, 0)).toEqual([])
  })

  test("returns no cells when nothing was used", () => {
    expect(compositionBarEntries({ ...compositionUsage, used: 0 }, config, 16)).toEqual([])
  })

  test("splits a 16-cell bar into cached 13, prompt 1, think 1 and out 1", () => {
    expect(compositionBarEntries(compositionUsage, config, 16)).toEqual([
      { id: "cached", cells: 13 },
      { id: "prompt", cells: 1 },
      { id: "think", cells: 1 },
      { id: "out", cells: 1 },
    ])
  })
})

describe("overviewLegendItems", () => {
  test("lists used, reserved and free with their letters and compact counts", () => {
    expect(overviewLegendItems(overviewUsage, config)).toEqual([
      { id: "used", letter: "u", label: "17.5K" },
      { id: "reserved", letter: "r", label: "100" },
      { id: "free", letter: "f", label: "2.4K" },
    ])
  })

  test("drops the free entry when free is excluded", () => {
    expect(overviewLegendItems(overviewUsage, { ...config, exclude: ["free"] })).toEqual([
      { id: "used", letter: "u", label: "17.5K" },
      { id: "reserved", letter: "r", label: "100" },
    ])
  })

  test("keeps used even when the exclude list names it", () => {
    // Raw config reaches `parseOptions` as unknown, and ids outside `SegmentId` are dropped there, so a
    // config carrying "used" is not expressible through the typed options object. The fixture models
    // the raw shape anyway: the point is that `overviewLegendItems` itself cannot be told to hide
    // `used` (it is the overview bar's own segment, which has no `SegmentId`).
    const rawOptions: unknown = { ...config, exclude: ["used"] }
    const items = overviewLegendItems(overviewUsage, rawOptions as ResolvedOptions)
    expect(items).toHaveLength(3)
    expect(items.map((item) => item.id)).toEqual(["used", "reserved", "free"])
  })
})

describe("compositionLegendItems", () => {
  test("lists cached, prompt, think and out with their letters and compact counts", () => {
    expect(compositionLegendItems(compositionUsage, config)).toEqual([
      { id: "cached", letter: "c", label: "16.3K" },
      { id: "prompt", letter: "p", label: "896" },
      { id: "think", letter: "t", label: "133" },
      { id: "out", letter: "o", label: "101" },
    ])
  })

  test("drops the prompt entry when prompt is excluded", () => {
    expect(compositionLegendItems(compositionUsage, { ...config, exclude: ["prompt"] })).toEqual([
      { id: "cached", letter: "c", label: "16.3K" },
      { id: "think", letter: "t", label: "133" },
      { id: "out", letter: "o", label: "101" },
    ])
  })

  test("labels every entry with the compact count of its segment", () => {
    const labels = compositionLegendItems(compositionUsage, config).map((item) => item.label)
    expect(labels).toEqual(["16.3K", "896", "133", "101"])
  })
})

describe("panel width", () => {
  test("subtracts the four frame columns from a 24-column panel", () => {
    setPanelWidth(24)
    expect(effectiveWidth()).toBe(20)
  })

  test("subtracts the four frame columns from an eight-column panel", () => {
    setPanelWidth(8)
    expect(effectiveWidth()).toBe(4)
  })

  test("tracks a wide 200-column panel", () => {
    setPanelWidth(200)
    expect(effectiveWidth()).toBe(196)
  })
})

// `TITLE_LABEL` is the 7-character literal `Context`, so the title ladder is: below 7 columns no
// title; 7 through 7 + percent length - 1 the label alone; 7 + percent length and above the label
// with the percentage. Every width below is written out by hand from those literals; no expectation
// calls `titleRung` to compute itself.
describe("titleRung", () => {
  test("omits the title one column below the seven-character label", () =>
    expect<TitleRung>(titleRung(6, "87% used")).toBe("none"))

  test("omits the title at a zero content width", () =>
    expect<TitleRung>(titleRung(0, "87% used")).toBe("none"))

  test("draws the label alone when it exactly fills the content width", () =>
    expect<TitleRung>(titleRung(7, "87% used")).toBe("label"))

  test("draws the label alone with an 8-character percent one column short of both", () =>
    expect<TitleRung>(titleRung(14, "87% used")).toBe("label"))

  test("draws label and 8-character percent at exactly 7 + 8 columns", () =>
    expect<TitleRung>(titleRung(15, "87% used")).toBe("both"))

  test("draws the label alone with a 9-character percent at the width that fits 87% used", () =>
    expect<TitleRung>(titleRung(15, "100% used")).toBe("label"))

  test("draws label and 9-character percent at exactly 7 + 9 columns", () =>
    expect<TitleRung>(titleRung(16, "100% used")).toBe("both"))
})

// By hand, with `n` labels and `gaps = n - 1` single-column gaps between them: each full entry costs
// 4 + label length cells (marker, space, letter, space, label), each stacked column costs
// max(3, label length), and each marker entry costs 3. The overview labels ["20.2K", "7K", "172.8K"]
// are 5, 2 and 6 characters: full = (4+5) + (4+2) + (4+6) + 2 = 27, stacked = max(3,5) + max(3,2) +
// max(3,6) + 2 = 16, markers = 3 * 3 + 2 = 11. The composition labels ["5.4K", "12.9K", "700",
// "1.2K"] are 4, 5, 3 and 4 characters: full = (4+4) + (4+5) + (4+3) + (4+4) + 3 = 35, stacked =
// 4 + 5 + 3 + 4 + 3 = 19, markers = 3 * 4 + 3 = 15. Each expectation below sits on one side of one
// of those three literal budgets; no expectation calls `legendRung` to compute itself.
describe("legendRung", () => {
  test("keeps every overview count on one line at the exact 27-column full budget", () =>
    expect<LegendRung>(legendRung(["20.2K", "7K", "172.8K"], 27)).toBe("full"))

  test("stacks the overview counts one column under the 27-column full budget", () =>
    expect<LegendRung>(legendRung(["20.2K", "7K", "172.8K"], 26)).toBe("stacked"))

  test("still stacks the overview counts at the exact 16-column stacked budget", () =>
    expect<LegendRung>(legendRung(["20.2K", "7K", "172.8K"], 16)).toBe("stacked"))

  test("drops the overview counts one column under the 16-column stacked budget", () =>
    expect<LegendRung>(legendRung(["20.2K", "7K", "172.8K"], 15)).toBe("markers"))

  test("still draws overview markers and letters at the exact 11-column markers budget", () =>
    expect<LegendRung>(legendRung(["20.2K", "7K", "172.8K"], 11)).toBe("markers"))

  test("omits the overview legend one column under the 11-column markers budget", () =>
    expect<LegendRung>(legendRung(["20.2K", "7K", "172.8K"], 10)).toBe("omit"))

  test("keeps every composition count on one line at the exact 35-column full budget", () =>
    expect<LegendRung>(legendRung(["5.4K", "12.9K", "700", "1.2K"], 35)).toBe("full"))

  test("stacks the composition counts one column under the 35-column full budget", () =>
    expect<LegendRung>(legendRung(["5.4K", "12.9K", "700", "1.2K"], 34)).toBe("stacked"))

  test("still stacks the composition counts at the exact 19-column stacked budget", () =>
    expect<LegendRung>(legendRung(["5.4K", "12.9K", "700", "1.2K"], 19)).toBe("stacked"))

  test("drops the composition counts one column under the 19-column stacked budget", () =>
    expect<LegendRung>(legendRung(["5.4K", "12.9K", "700", "1.2K"], 18)).toBe("markers"))

  test("still draws composition markers and letters at the exact 15-column markers budget", () =>
    expect<LegendRung>(legendRung(["5.4K", "12.9K", "700", "1.2K"], 15)).toBe("markers"))

  test("omits the composition legend one column under the 15-column markers budget", () =>
    expect<LegendRung>(legendRung(["5.4K", "12.9K", "700", "1.2K"], 14)).toBe("omit"))

  test("omits an empty legend at any width", () =>
    expect<LegendRung>(legendRung([], 200)).toBe("omit"))

  test("omits a populated legend at a zero content width", () =>
    expect<LegendRung>(legendRung(["20.2K", "7K", "172.8K"], 0)).toBe("omit"))
})
