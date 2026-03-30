/** `typeof x === "object"` but excludes `null` and arrays (use `Array.isArray` elsewhere when needed). */
export function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x)
}

export function isStringRecord(x: unknown): x is Record<string, string> {
  if (!isRecord(x)) return false
  for (const v of Object.values(x)) {
    if (typeof v !== "string") return false
  }
  return true
}

export function idbTag(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined
  const t = value.__idb
  return typeof t === "string" ? t : undefined
}