export type TokenCounts = { input: number; output: number; reasoning: number; cacheRead: number; cacheWrite: number }
export type UsageLimits = { context: number; output: number }
export type SegmentId = "cached" | "prompt" | "think" | "out" | "reserved" | "free"
export type Segment = { id: SegmentId; tokens: number }
export type Usage = { used: number; window: number; percent: number; segments: Segment[]; known: boolean }
export type PluginOptions_ = { barWidth?: number; exclude?: SegmentId[]; showLegend?: boolean }
