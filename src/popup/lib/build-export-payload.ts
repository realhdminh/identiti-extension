import { filterIndexedDBExport } from "@/lib/indexeddb"
import {
  type CredentialExportFile,
  cookieRowId,
  EXPORT_SCHEMA_VERSION,
  type ExportedCookie,
} from "@/lib/page-credentials"
import { lsKeyId, ssKeyId } from "@/popup/lib/selection-ids"

export function buildSelectedExportPayload(input: {
  origin: string
  tabUrl: string
  cookies: ExportedCookie[]
  lsEntries: Record<string, string>
  ssEntries: Record<string, string>
  idbData: Parameters<typeof filterIndexedDBExport>[0]
  selected: Set<string>
}): CredentialExportFile | null {
  const pickCookies = input.cookies.filter((c) =>
    input.selected.has(cookieRowId(c))
  )
  const pickLs: Record<string, string> = {}
  for (const k of Object.keys(input.lsEntries)) {
    if (input.selected.has(lsKeyId(k))) pickLs[k] = input.lsEntries[k]
  }
  const pickSs: Record<string, string> = {}
  for (const k of Object.keys(input.ssEntries)) {
    if (input.selected.has(ssKeyId(k))) pickSs[k] = input.ssEntries[k]
  }
  const pickIdb = filterIndexedDBExport(input.idbData, input.selected)
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
    pageUrl: input.tabUrl,
    cookies: pickCookies,
    localStorage: pickLs,
    sessionStorage: pickSs,
    indexedDB: pickIdb,
  }
}