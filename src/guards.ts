/** True only for plain non-null, non-array objects. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Narrows `value` to a plain record, or an empty record when it is not one. */
export function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}
