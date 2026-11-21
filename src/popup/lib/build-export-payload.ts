import type { IndexedDBExport } from "@/lib/indexeddb"
import {
  type CredentialExportFile,
  EXPORT_SCHEMA_VERSION,
  type ExportedCookie,
} from "@/lib/page-credentials"

export function buildExportPayload(input: {
  origin: string
  cookies: ExportedCookie[]
  lsEntries: Record<string, string>
  ssEntries: Record<string, string>
  idbData: IndexedDBExport
}): CredentialExportFile | null {
  const pickCookies = input.cookies
  const pickLs: Record<string, string> = { ...input.lsEntries }
  const pickSs: Record<string, string> = { ...input.ssEntries }
  const pickIdb = Object.fromEntries(
    Object.entries(input.idbData).filter(([, db]) => db.stores.length > 0)
  )
  const anyIdb = Object.keys(pickIdb).length > 0
  if (
    pickCookies.length === 0 &&
    Object.keys(pickLs).length === 0 &&
    Object.keys(pickSs).length === 0 &&
    !anyIdb
  ) {
    return null
  }
  return {
    identitiVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    origin: input.origin,
    environment:
      typeof navigator !== "undefined" && typeof window !== "undefined"
        ? {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screen: `${window.screen.width}x${window.screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }
        : undefined,
    cookies: pickCookies,
    localStorage: pickLs,
    sessionStorage: pickSs,
    indexedDB: pickIdb,
  }
}