import type { Browser } from "wxt/browser"
import type { IndexedDBExport } from "@/lib/indexeddb"
import { filterIndexedDBExport, idbRecordId } from "@/lib/indexeddb"
import { isRecord, isStringRecord } from "@/lib/type-guards"

export const EXPORT_SCHEMA_VERSION = 2 as const
export const MIN_IMPORT_SCHEMA_VERSION = 1 as const

/** Runtime cookie from `browser.cookies` (Chrome types via `@wxt-dev/browser` / `@types/chrome`). */
type BrowserCookie = Browser.cookies.Cookie

/** Cookie in export JSON / UI — matches extension cookie shape; `storeId` defaultable when importing older files. */
export type ExportedCookie = Browser.cookies.Cookie

export type CredentialExportFile = {
  identitiVersion:
    | typeof MIN_IMPORT_SCHEMA_VERSION
    | typeof EXPORT_SCHEMA_VERSION
  exportedAt: string
  origin: string
  pageUrl?: string
  cookies: ExportedCookie[]
  localStorage: Record<string, string>
  sessionStorage: Record<string, string>
  indexedDB: IndexedDBExport
}

export const MESSAGE_LS_GET = "identiti:ls-get" as const
export const MESSAGE_LS_SET = "identiti:ls-set" as const
export const MESSAGE_SS_GET = "identiti:ss-get" as const
export const MESSAGE_SS_SET = "identiti:ss-set" as const
export const MESSAGE_IDB_DUMP = "identiti:idb-dump" as const
export const MESSAGE_IDB_APPLY = "identiti:idb-apply" as const
export const MESSAGE_IDB_MERGE = "identiti:idb-merge" as const

export type MessageLsSet = {
  type: typeof MESSAGE_LS_SET
  entries: Record<string, string>
}
export type MessageSsSet = {
  type: typeof MESSAGE_SS_SET
  entries: Record<string, string>
}
export type MessageIdbApply = {
  type: typeof MESSAGE_IDB_APPLY
  snapshot: IndexedDBExport
}
export type MessageIdbMerge = {
  type: typeof MESSAGE_IDB_MERGE
  snapshot: IndexedDBExport
}

type TabStorageResponse =
  | { ok: true; entries: Record<string, string> }
  | { ok: false; error: string }

type TabOkResponse = { ok: true } | { ok: false; error: string }

type TabIdbDumpResponse =
  | { ok: true; data: IndexedDBExport }
  | { ok: false; error: string }

function isIndexedDBExportLike(x: unknown): x is IndexedDBExport {
  if (!isRecord(x)) return false
  for (const v of Object.values(x)) {
    if (!isRecord(v)) return false
    if (typeof v.version !== "number") return false
    if (!Array.isArray(v.stores)) return false
  }
  return true
}

export function isMessageLsSet(m: unknown): m is MessageLsSet {
  return (
    isRecord(m) &&
    m.type === MESSAGE_LS_SET &&
    "entries" in m &&
    isStringRecord(m.entries)
  )
}

export function isMessageSsSet(m: unknown): m is MessageSsSet {
  return (
    isRecord(m) &&
    m.type === MESSAGE_SS_SET &&
    "entries" in m &&
    isStringRecord(m.entries)
  )
}

export function isMessageIdbApply(m: unknown): m is MessageIdbApply {
  return (
    isRecord(m) &&
    m.type === MESSAGE_IDB_APPLY &&
    "snapshot" in m &&
    isIndexedDBExportLike(m.snapshot)
  )
}

export function isMessageIdbMerge(m: unknown): m is MessageIdbMerge {
  return (
    isRecord(m) &&
    m.type === MESSAGE_IDB_MERGE &&
    "snapshot" in m &&
    isIndexedDBExportLike(m.snapshot)
  )
}

function assertIdentitiVersion(v: unknown): asserts v is 1 | 2 {
  if (v !== 1 && v !== 2) throw new Error("BAD_VERSION")
}

function parseSameSiteString(raw: string): BrowserCookie["sameSite"] {
  switch (raw) {
    case "no_restriction":
    case "lax":
    case "strict":
    case "unspecified":
      return raw
    default:
      return "unspecified"
  }
}

function parsePartitionKey(
  raw: unknown
): BrowserCookie["partitionKey"] | undefined {
  if (!isRecord(raw)) return undefined
  const out: BrowserCookie["partitionKey"] = {}
  if (typeof raw.topLevelSite === "string") out.topLevelSite = raw.topLevelSite
  if (typeof raw.hasCrossSiteAncestor === "boolean") {
    out.hasCrossSiteAncestor = raw.hasCrossSiteAncestor
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function isSupportedWebUrl(url: string | undefined): url is string {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

export function originFromUrl(url: string): string {
  return new URL(url).origin
}

export function serializeCookie(c: BrowserCookie): ExportedCookie {
  return {
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    secure: c.secure,
    httpOnly: c.httpOnly,
    sameSite: c.sameSite,
    expirationDate: c.expirationDate,
    hostOnly: c.hostOnly,
    session: c.session,
    storeId: c.storeId,
    partitionKey: c.partitionKey,
  }
}

export function cookieRowId(c: ExportedCookie): string {
  return `c:${c.storeId ?? ""}|${c.domain}|${c.path}|${c.name}`
}

function bestEffortRegistrableDomain(hostname: string): string {
  // Heuristic only: we want "everything under this site" (for subdomain cookies).
  // For complex public-suffix cases, Chrome's cookie API still returns best-effort within permissions.
  if (hostname === "localhost") return hostname
  if (hostname.includes(":")) return hostname // IPv6-ish
  const parts = hostname.split(".").filter(Boolean)
  if (parts.length <= 2) return hostname
  const last2 = parts.slice(-2).join(".")
  return last2
}

function parseIndexedDBImport(raw: unknown): IndexedDBExport {
  if (!isRecord(raw)) return {}
  const out: IndexedDBExport = {}
  for (const [dbName, dbVal] of Object.entries(raw)) {
    if (!isRecord(dbVal)) continue
    const d = dbVal
    const version =
      typeof d.version === "number" ? d.version : Number(d.version) || 1
    const storesRaw = d.stores
    const stores: {
      name: string
      records: { key: unknown; value: unknown }[]
    }[] = []
    if (Array.isArray(storesRaw)) {
      for (const s of storesRaw) {
        if (!isRecord(s)) continue
        const st = s
        const name = typeof st.name === "string" ? st.name : ""
        if (!name) continue
        const recs: { key: unknown; value: unknown }[] = []
        if (Array.isArray(st.records)) {
          for (const r of st.records) {
            if (!isRecord(r)) continue
            const row = r
            if (!("key" in row) || !("value" in row)) continue
            recs.push({ key: row.key, value: row.value })
          }
        }
        stores.push({ name, records: recs })
      }
    }
    if (stores.length > 0) out[dbName] = { version, stores }
  }
  return out
}

export function parseExportFile(text: string): CredentialExportFile {
  const data = JSON.parse(text) as unknown
  if (!isRecord(data)) {
    throw new Error("INVALID_JSON")
  }
  const o = data
  const ver = o.identitiVersion
  assertIdentitiVersion(ver)
  if (typeof o.exportedAt !== "string" || typeof o.origin !== "string") {
    throw new Error("MISSING_META")
  }
  if (!Array.isArray(o.cookies)) {
    throw new Error("BAD_COOKIES")
  }
  const normalizedCookies: ExportedCookie[] = []
  for (const item of o.cookies) {
    if (!isRecord(item)) throw new Error("BAD_COOKIES")
    const c = item
    if (typeof c.name !== "string" || typeof c.value !== "string") {
      throw new Error("BAD_COOKIES")
    }
    if (typeof c.domain !== "string") throw new Error("BAD_COOKIES")
    const path = typeof c.path === "string" ? c.path : "/"
    const sameSiteRaw =
      typeof c.sameSite === "string" ? c.sameSite : "unspecified"
    normalizedCookies.push({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path,
      secure: c.secure === true,
      httpOnly: c.httpOnly === true,
      sameSite: parseSameSiteString(sameSiteRaw),
      expirationDate:
        typeof c.expirationDate === "number" ? c.expirationDate : undefined,
      hostOnly: c.hostOnly === true,
      session: c.session === true,
      storeId: typeof c.storeId === "string" ? c.storeId : "",
      partitionKey: parsePartitionKey(c.partitionKey),
    })
  }
  if (!isStringRecord(o.localStorage)) {
    throw new Error("BAD_LS")
  }
  const localStorage: Record<string, string> = { ...o.localStorage }

  let sessionStorage: Record<string, string> = {}
  let indexedDB: IndexedDBExport = {}
  if (ver === 2) {
    if (o.sessionStorage !== undefined && o.sessionStorage !== null) {
      if (!isStringRecord(o.sessionStorage)) throw new Error("BAD_SS")
      sessionStorage = { ...o.sessionStorage }
    }
    indexedDB = parseIndexedDBImport(o.indexedDB)
  }

  return {
    identitiVersion: ver,
    exportedAt: o.exportedAt,
    origin: o.origin,
    pageUrl: typeof o.pageUrl === "string" ? o.pageUrl : undefined,
    cookies: normalizedCookies,
    localStorage,
    sessionStorage,
    indexedDB,
  }
}

export function partitionIndexedDBForImport(
  payload: CredentialExportFile,
  selectedIds: Set<string>
): { replace: IndexedDBExport; merge: IndexedDBExport } {
  const replace: IndexedDBExport = {}
  const merge: IndexedDBExport = {}
  for (const [dbName, data] of Object.entries(payload.indexedDB)) {
    const allInDbSelected = data.stores.every((st) =>
      st.records.every((rec) =>
        selectedIds.has(idbRecordId(dbName, st.name, rec.key))
      )
    )
    const filtered = filterIndexedDBExport({ [dbName]: data }, selectedIds)
    const part = filtered[dbName]
    if (!part) continue
    if (allInDbSelected) replace[dbName] = part
    else merge[dbName] = part
  }
  return { replace, merge }
}

export async function getCookiesForUrl(
  url: string,
  tabId?: number
): Promise<ExportedCookie[]> {
  const u = new URL(url)
  const origin = u.origin
  const hostname = u.hostname
  const domain = bestEffortRegistrableDomain(hostname)

  const stores =
    tabId != null ? await browser.cookies.getAllCookieStores() : undefined
  const storeId =
    tabId != null
      ? stores?.find((s) => s.tabIds.includes(tabId))?.id
      : undefined

  const base = {
    url,
    storeId,
  }

  const dedupe = new Map<string, BrowserCookie>()
  const add = (list: BrowserCookie[]) => {
    for (const c of list) dedupe.set(cookieRowId(serializeCookie(c)), c)
  }

  // 1) Current host cookies (includes Domain cookies that scope to this host).
  add(await browser.cookies.getAll(base))

  // 2) Subdomain host-only cookies (domain filter includes subdomains).
  if (domain && domain !== hostname) {
    add(await browser.cookies.getAll({ domain, storeId }))
  }

  // 3) Partitioned/cross-site (3rd-party) cookies when available.
  const partitionKey = {
    topLevelSite: origin,
    hasCrossSiteAncestor: true,
  }
  add(
    await browser.cookies.getAll({
      ...base,
      partitionKey,
    })
  )
  if (domain && domain !== hostname) {
    add(
      await browser.cookies.getAll({
        domain,
        storeId,
        partitionKey,
      })
    )
  }

  return Array.from(dedupe.values()).map((c) => serializeCookie(c))
}

export async function setCookieOnTab(
  tabUrl: string,
  c: ExportedCookie
): Promise<void> {
  const details: Parameters<typeof browser.cookies.set>[0] = {
    url: tabUrl,
    name: c.name,
    value: c.value,
    path: c.path || "/",
    secure: c.secure,
    httpOnly: c.httpOnly,
    storeId: c.storeId,
  }
  if (c.sameSite && c.sameSite !== "unspecified") {
    details.sameSite = c.sameSite
  }
  if (!c.session && c.expirationDate != null) {
    details.expirationDate = c.expirationDate
  }
  if (!c.hostOnly && c.domain) {
    details.domain = c.domain
  }
  if (c.partitionKey) {
    details.partitionKey = c.partitionKey
  }
  await browser.cookies.set(details)
}

function collectLocalStorageFromWindow(
  ..._args: unknown[]
): Record<string, string> {
  const entries: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k) entries[k] = localStorage.getItem(k) ?? ""
  }
  return entries
}

function applyLocalStorageToWindow(entries: Record<string, string>): void {
  for (const [k, v] of Object.entries(entries)) {
    localStorage.setItem(k, v)
  }
}

function collectSessionStorageFromWindow(
  ..._args: unknown[]
): Record<string, string> {
  const entries: Record<string, string> = {}
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i)
    if (k) entries[k] = sessionStorage.getItem(k) ?? ""
  }
  return entries
}

function applySessionStorageToWindow(entries: Record<string, string>): void {
  for (const [k, v] of Object.entries(entries)) {
    sessionStorage.setItem(k, v)
  }
}

function injectApplyLocalStorage(...args: unknown[]): void {
  const first = args[0]
  if (!isStringRecord(first)) return
  applyLocalStorageToWindow(first)
}

function injectApplySessionStorage(...args: unknown[]): void {
  const first = args[0]
  if (!isStringRecord(first)) return
  applySessionStorageToWindow(first)
}

/**
 * Runs `func` in the page (MV3 scripting with closure args, or MV2 `tabs.executeScript` + JSON args).
 */
async function runScriptInTab<T>(
  tabId: number,
  func: (...args: unknown[]) => T,
  args: unknown[] = []
): Promise<T> {
  if (typeof browser.scripting?.executeScript === "function") {
    const injected = await browser.scripting.executeScript({
      target: { tabId },
      func: () => func(...args),
    })
    const first = injected?.[0]
    if (!first || !("result" in first)) {
      throw new Error("INJECT_FAILED")
    }
    return first.result as T
  }
  if (typeof browser.tabs.executeScript === "function") {
    const payload = JSON.stringify(args)
    const code = `(() => { const args = JSON.parse(${JSON.stringify(payload)}); return (${func.toString()}).apply(null, args); })()`
    const res = await browser.tabs.executeScript(tabId, { code })
    return res?.[0] as T
  }
  throw new Error("NO_SCRIPTING")
}

export async function readPageLocalStorage(
  tabId: number
): Promise<Record<string, string>> {
  try {
    const res = (await browser.tabs.sendMessage(tabId, {
      type: MESSAGE_LS_GET,
    })) as TabStorageResponse
    if (res?.ok) return res.entries
  } catch {
    /* fall through */
  }
  return runScriptInTab(tabId, collectLocalStorageFromWindow)
}

export async function writePageLocalStorage(
  tabId: number,
  entries: Record<string, string>
): Promise<void> {
  const msg: MessageLsSet = { type: MESSAGE_LS_SET, entries }
  try {
    const res = (await browser.tabs.sendMessage(tabId, msg)) as TabOkResponse
    if (res?.ok) return
  } catch {
    /* fall through */
  }
  await runScriptInTab(tabId, injectApplyLocalStorage, [entries])
}

export async function readPageSessionStorage(
  tabId: number
): Promise<Record<string, string>> {
  try {
    const res = (await browser.tabs.sendMessage(tabId, {
      type: MESSAGE_SS_GET,
    })) as TabStorageResponse
    if (res?.ok) return res.entries
  } catch {
    /* fall through */
  }
  return runScriptInTab(tabId, collectSessionStorageFromWindow)
}

export async function writePageSessionStorage(
  tabId: number,
  entries: Record<string, string>
): Promise<void> {
  const msg: MessageSsSet = { type: MESSAGE_SS_SET, entries }
  try {
    const res = (await browser.tabs.sendMessage(tabId, msg)) as TabOkResponse
    if (res?.ok) return
  } catch {
    /* fall through */
  }
  await runScriptInTab(tabId, injectApplySessionStorage, [entries])
}

export async function readPageIndexedDB(
  tabId: number
): Promise<IndexedDBExport> {
  const res = (await browser.tabs.sendMessage(tabId, {
    type: MESSAGE_IDB_DUMP,
  })) as TabIdbDumpResponse
  if (!res?.ok) {
    throw new Error(res?.error ?? "IDB_DUMP_FAILED")
  }
  return res.data
}

export async function applyPageIndexedDBOnTab(
  tabId: number,
  snapshot: IndexedDBExport
): Promise<void> {
  const msg: MessageIdbApply = { type: MESSAGE_IDB_APPLY, snapshot }
  const res = (await browser.tabs.sendMessage(tabId, msg)) as TabOkResponse
  if (!res?.ok) {
    throw new Error(res?.error ?? "IDB_APPLY_FAILED")
  }
}

export async function mergePageIndexedDBOnTab(
  tabId: number,
  snapshot: IndexedDBExport
): Promise<void> {
  const msg: MessageIdbMerge = { type: MESSAGE_IDB_MERGE, snapshot }
  const res = (await browser.tabs.sendMessage(tabId, msg)) as TabOkResponse
  if (!res?.ok) {
    throw new Error(res?.error ?? "IDB_MERGE_FAILED")
  }
}