export function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return `${s.slice(0, n)}…`
}

export function slugForFilename(origin: string): string {
  try {
    const u = new URL(origin)
    return `${u.hostname}`.replace(/[^\w.-]+/g, "_").slice(0, 64) || "site"
  } catch {
    return "site"
  }
}