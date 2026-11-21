import { getDomain } from "tldts"
import type { Browser } from "wxt/browser"
import type {
  IndexedDBExport,
  IndexedDBScope,
  IndexedDBStoreDump,
} from "@/lib/indexeddb"
import { type PageIdentity, sendMessage } from "@/lib/messaging"
import { isRecord, isStringRecord } from "@/lib/type-guards"

export const EXPORT_SCHEMA_VERSION = 3 as const
export const MIN_IMPORT_SCHEMA_VERSION = 1 as const

/** Runtime cookie from `browser.cookies` (Chrome types via `@wxt-dev/browser` / `@types/chrome`). */
type BrowserCookie = Browser.cookies.Cookie

/** Cookie in export JSON / UI — matches extension cookie shape; `storeId` defaultable when importing older files. */
export type ExportedCookie = Browser.cookies.Cookie

export function environmentsDiffer(
  a?: EnvironmentSnapshot,
  b?: EnvironmentSnapshot
): boolean {
  if (!a || !b) return false
  return a.platform !== b.platform || a.userAgent !== b.userAgent
}

export type EnvironmentSnapshot = {
  userAgent: string
  platform: string
  language: string
  screen?: string
  timezone?: string
}

export type CredentialExportFile = {
  identitiVersion: 1 | 2 | 3
  environment?: EnvironmentSnapshot
  exportedAt: string
  origin: string
  cookies: ExportedCookie[]
  localStorage: Record<string, string>
  sessionStorage: Record<string, string>
  indexedDB: IndexedDBExport
}

function assertIdentitiVersion(v: unknown): asserts v is 1 | 2 | 3 {
  if (v !== 1 && v !== 2 && v !== 3) throw new Error("BAD_VERSION")
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

function partitionKeyId(key: ExportedCookie["partitionKey"]) {
  return [
    key?.topLevelSite ? new URL(key.topLevelSite).origin : null,
    key?.hasCrossSiteAncestor ?? false,
  ]
}

function cookieId(cookie: ExportedCookie) {
  return JSON.stringify([
    cookieHost(cookie.domain),
    cookie.path,
    cookie.name,
    cookie.hostOnly,
    ...partitionKeyId(cookie.partitionKey),
  ])
}

function siteHost(hostname: string): string {
  return getDomain(hostname, { allowPrivateDomains: true }) ?? hostname
}

function schemefulSite(url: URL): string {
  return `${url.protocol}//${siteHost(url.hostname)}`
}

function cookieHost(domain: string): string {
  const host = domain.startsWith(".") ? domain.slice(1) : domain
  if (!host || /[\s/@?#\\%]/.test(host)) throw new Error("BAD_COOKIE_DOMAIN")
  const url = new URL(`https://${host}`)
  if (url.hostname !== host.toLowerCase()) throw new Error("BAD_COOKIE_DOMAIN")
  return url.hostname
}

function readKeyPath(value: unknown): value is string | string[] {
  return (
    typeof value === "string" ||
    (Array.isArray(value) && value.every((key) => typeof key === "string"))
  )
}

function parseIndexedDBImport(raw: unknown, version: 2 | 3): IndexedDBExport {
  if (raw == null && version === 2) return {}
  if (!isRecord(raw)) throw new Error("BAD_IDB")
  return Object.fromEntries(
    Object.entries(raw).map(([name, database]) => {
      if (
        !isRecord(database) ||
        typeof database.version !== "number" ||
        !Number.isSafeInteger(database.version) ||
        database.version < 1 ||
        !Array.isArray(database.stores)
      )
        throw new Error("BAD_IDB")
      const names = new Set<string>()
      const stores = database.stores.map(
        (store: unknown): IndexedDBStoreDump => {
          if (
            !isRecord(store) ||
            typeof store.name !== "string" ||
            names.has(store.name) ||
            !Array.isArray(store.records)
          )
            throw new Error("BAD_IDB_STORE")
          names.add(store.name)
          const entry: IndexedDBStoreDump = {
            name: store.name,
            records: store.records.map((row: unknown) => {
              if (
                !isRecord(row) ||
                !Object.hasOwn(row, "key") ||
                !Object.hasOwn(row, "value")
              ) {
                throw new Error("BAD_IDB_RECORD")
              }
              return { key: row.key, value: row.value }
            }),
          }
          if (store.keyPath !== undefined) {
            if (store.keyPath !== null && !readKeyPath(store.keyPath)) {
              throw new Error("BAD_IDB_KEY_PATH")
            }
            entry.keyPath = store.keyPath
          }
          if (typeof store.autoIncrement === "boolean")
            entry.autoIncrement = store.autoIncrement
          if (store.indexes !== undefined) {
            if (!Array.isArray(store.indexes)) throw new Error("BAD_IDB_INDEX")
            entry.indexes = store.indexes.map((index: unknown) => {
              if (
                !isRecord(index) ||
                typeof index.name !== "string" ||
                !readKeyPath(index.keyPath)
              ) {
                throw new Error("BAD_IDB_INDEX")
              }
              return {
                name: index.name,
                keyPath: index.keyPath,
                unique: index.unique === true,
                multiEntry: index.multiEntry === true,
              }
            })
          }
          if (store.valueEncoding === "graph") entry.valueEncoding = "graph"
          else if (version === 2 || store.valueEncoding === "legacy")
            entry.valueEncoding = "legacy"
          else if (store.valueEncoding !== undefined)
            throw new Error("BAD_IDB_ENCODING")
          return entry
        }
      )
      return [name, { version: database.version, stores }]
    })
  )
}

export function parseExportFile(text: string): CredentialExportFile {
  const data = JSON.parse(text) as unknown
  if (!isRecord(data)) {
    throw new Error("INVALID_JSON")
  }
  const o = data
  const ver = o.identitiVersion
  assertIdentitiVersion(ver)
  if (
    typeof o.exportedAt !== "string" ||
    typeof o.origin !== "string" ||
    !isSupportedWebUrl(o.origin) ||
    new URL(o.origin).origin !== o.origin
  ) {
    throw new Error("MISSING_META")
  }
  if (!Array.isArray(o.cookies)) {
    throw new Error("BAD_COOKIES")
  }
  let environment: EnvironmentSnapshot | undefined
  if (isRecord(o.environment)) {
    const e = o.environment
    if (typeof e.userAgent === "string") {
      environment = {
        userAgent: e.userAgent,
        platform: typeof e.platform === "string" ? e.platform : "",
        language: typeof e.language === "string" ? e.language : "",
        screen: typeof e.screen === "string" ? e.screen : undefined,
        timezone: typeof e.timezone === "string" ? e.timezone : undefined,
      }
    }
  }

  const normalizedCookies: ExportedCookie[] = []
  for (const item of o.cookies) {
    if (!isRecord(item)) throw new Error("BAD_COOKIES")
    const c = item
    if (typeof c.name !== "string" || typeof c.value !== "string") {
      throw new Error("BAD_COOKIES")
    }
    if (typeof c.domain !== "string") throw new Error("BAD_COOKIES")
    if (typeof c.firstPartyDomain === "string" && c.firstPartyDomain !== "") {
      throw new Error("UNSUPPORTED_FIRST_PARTY_COOKIE")
    }
    const partitionKey = parsePartitionKey(c.partitionKey)
    if (c.partitionKey != null && !partitionKey)
      throw new Error("BAD_COOKIE_PARTITION")
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
      partitionKey,
    })
  }
  if (!isStringRecord(o.localStorage)) {
    throw new Error("BAD_LS")
  }
  const localStorage: Record<string, string> = { ...o.localStorage }

  let sessionStorage: Record<string, string> = {}
  let indexedDB: IndexedDBExport = {}
  if (ver === 2 || ver === 3) {
    if (ver === 3 || o.sessionStorage != null) {
      if (!isStringRecord(o.sessionStorage)) throw new Error("BAD_SS")
      sessionStorage = { ...o.sessionStorage }
    }
    indexedDB = parseIndexedDBImport(o.indexedDB, ver)
  }

  return {
    identitiVersion: ver,
    exportedAt: o.exportedAt,
    origin: o.origin,
    environment,
    cookies: normalizedCookies,
    localStorage,
    sessionStorage,
    indexedDB,
  }
}

export type SiteTarget = PageIdentity & {
  tabId: number
  url: string
  storeId: string
}

export async function storeIdForTab(tabId: number): Promise<string> {
  const tab = await browser.tabs.get(tabId)
  if ("cookieStoreId" in tab && typeof tab.cookieStoreId === "string") {
    return tab.cookieStoreId
  }
  const stores = await browser.cookies.getAllCookieStores()
  const storeId = stores.find((store) => store.tabIds.includes(tabId))?.id
  if (!storeId) throw new Error("COOKIE_STORE_UNAVAILABLE")
  return storeId
}

function topFrame(tabId: number) {
  return { tabId, frameId: 0 }
}

export async function resolveSiteTarget(
  tabId: number,
  origin: string
): Promise<SiteTarget> {
  const [tab, identity, storeId] = await Promise.all([
    browser.tabs.get(tabId),
    sendMessage("site-target", undefined, topFrame(tabId)).catch((cause) => {
      throw new Error("PAGE_STORAGE_READ_FAILED", { cause })
    }),
    storeIdForTab(tabId),
  ])
  if (
    !isSupportedWebUrl(tab.url) ||
    originFromUrl(tab.url) !== origin ||
    identity.origin !== origin
  ) {
    throw new Error("SITE_TARGET_CHANGED")
  }
  return { ...identity, tabId, storeId, url: tab.url }
}

async function assertCurrentTarget(target: SiteTarget) {
  const current = await resolveSiteTarget(target.tabId, target.origin)
  if (
    current.documentToken !== target.documentToken ||
    current.storeId !== target.storeId
  ) {
    throw new Error("SITE_TARGET_CHANGED")
  }
}

function partitionForSite(
  key: ExportedCookie["partitionKey"],
  page: URL
): boolean {
  if (!key?.topLevelSite || !isSupportedWebUrl(key.topLevelSite)) return false
  const partition = new URL(key.topLevelSite)
  return (
    !partition.username &&
    !partition.password &&
    partition.pathname === "/" &&
    !partition.search &&
    !partition.hash &&
    schemefulSite(partition) === schemefulSite(page) &&
    (!partition.port || partition.port === page.port)
  )
}

function isCookieInSite(
  cookie: ExportedCookie,
  host: string,
  page: URL
): boolean {
  if (cookie.partitionKey) return partitionForSite(cookie.partitionKey, page)
  return siteHost(host) === siteHost(page.hostname)
}

function hasInvalidCookiePath(path: string): boolean {
  for (const character of path) {
    const code = character.codePointAt(0) ?? 0
    if (code < 0x20 || code === 0x7f || character === ";") return true
  }
  return false
}

export function assertCookiesForSite(
  url: string,
  cookies: readonly ExportedCookie[]
) {
  const page = new URL(url)
  for (const cookie of cookies) {
    const host = cookieHost(cookie.domain)
    if (
      !isCookieInSite(cookie, host, page) ||
      !cookie.path.startsWith("/") ||
      (!import.meta.env.FIREFOX &&
        !cookie.secure &&
        (cookie.partitionKey != null ||
          cookie.sameSite === "no_restriction")) ||
      (!import.meta.env.FIREFOX &&
        new URL(cookieSetUrl(cookie, url)).pathname !== cookie.path) ||
      hasInvalidCookiePath(cookie.path) ||
      (cookie.name.startsWith("__Host-") &&
        (!cookie.hostOnly || !cookie.secure || cookie.path !== "/")) ||
      (cookie.name.startsWith("__Secure-") && !cookie.secure)
    ) {
      throw new Error("COOKIE_OUTSIDE_SITE_OR_INVALID")
    }
  }
}

export async function getCookiesForUrl(
  target: SiteTarget
): Promise<ExportedCookie[]> {
  const page = new URL(target.url)
  const domain = siteHost(page.hostname)
  const { storeId } = target
  const partitionSites = [schemefulSite(page)]
  if (import.meta.env.FIREFOX && domain === page.hostname && page.port) {
    partitionSites.push(`${partitionSites[0]}:${page.port}`)
  }
  const queries = partitionSites.flatMap((topLevelSite) =>
    [true, false].map((hasCrossSiteAncestor) =>
      browser.cookies.getAll({
        storeId,
        partitionKey: { topLevelSite, hasCrossSiteAncestor },
      })
    )
  )
  const batches = await Promise.all([
    browser.cookies.getAll({ url: target.url, storeId }),
    browser.cookies.getAll({ domain, storeId }),
    ...queries,
  ])
  await assertCurrentTarget(target)
  const cookies = new Map<string, ExportedCookie>()
  for (const batch of batches) {
    for (const cookie of batch) {
      if (
        cookie.storeId === storeId &&
        isCookieInSite(cookie, cookieHost(cookie.domain), page)
      ) {
        cookies.set(cookieId(cookie), cookie)
      }
    }
  }
  return [...cookies.values()]
}

/** Uses the cookie's own hostname, including when it belongs to a sibling host. */
export function cookieSetUrl(cookie: ExportedCookie, pageUrl?: string): string {
  const scheme =
    cookie.secure || pageUrl?.startsWith("https:") ? "https" : "http"
  const url = new URL(`${scheme}://${cookieHost(cookie.domain)}`)
  url.pathname = cookie.path
  return url.href
}

function cookieDetails(target: SiteTarget, cookie: ExportedCookie) {
  const details: Parameters<typeof browser.cookies.set>[0] = {
    url: cookieSetUrl(cookie, target.url),
    name: cookie.name,
    value: cookie.value,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    storeId: target.storeId,
  }
  if (!cookie.hostOnly) details.domain = cookieHost(cookie.domain)
  if (cookie.sameSite !== "unspecified") details.sameSite = cookie.sameSite
  if (!cookie.session && cookie.expirationDate !== undefined) {
    details.expirationDate = cookie.expirationDate
  }
  if (cookie.partitionKey) {
    const partition = new URL(cookie.partitionKey.topLevelSite!)
    details.partitionKey = {
      topLevelSite: partition.origin,
      hasCrossSiteAncestor:
        cookie.partitionKey.hasCrossSiteAncestor ??
        schemefulSite(new URL(details.url)) !== schemefulSite(partition),
    }
  }
  return details
}

export async function setCookiesOnTab(
  target: SiteTarget,
  cookies: ExportedCookie[]
): Promise<number> {
  assertCookiesForSite(target.url, cookies)
  let failed = 0
  for (let i = 0; i < cookies.length; i += 8) {
    await assertCurrentTarget(target)
    const results = await Promise.allSettled(
      cookies.slice(i, i + 8).map(async (cookie) => {
        if (
          cookie.expirationDate !== undefined &&
          cookie.expirationDate <= Date.now() / 1000
        )
          return
        const details = cookieDetails(target, cookie)
        const expected = cookieId({
          ...cookie,
          partitionKey: details.partitionKey,
        })
        const matches = (stored: BrowserCookie) =>
          stored.storeId === target.storeId &&
          cookieId(stored) === expected &&
          stored.value === cookie.value
        const result = await browser.cookies.set(details)
        if (result && matches(result)) return
        const others = await browser.cookies.getAll({
          url: details.url,
          name: details.name,
          path: details.path,
          storeId: details.storeId,
          partitionKey: details.partitionKey,
        })
        if (!others.some(matches)) throw new Error("COOKIE_WRITE_FAILED")
      })
    )
    for (const result of results) if (result.status === "rejected") failed++
  }
  return failed
}

export function readPageLocalStorage(target: SiteTarget) {
  return sendMessage("ls-get", target, topFrame(target.tabId)).catch(
    (cause) => {
      throw new Error("PAGE_STORAGE_READ_FAILED", { cause })
    }
  )
}

export function writePageLocalStorage(
  target: SiteTarget,
  entries: Record<string, string>
) {
  return sendMessage("ls-set", { ...target, entries }, topFrame(target.tabId))
}

export function readPageSessionStorage(target: SiteTarget) {
  return sendMessage("ss-get", target, topFrame(target.tabId)).catch(
    (cause) => {
      throw new Error("PAGE_STORAGE_READ_FAILED", { cause })
    }
  )
}

export function writePageSessionStorage(
  target: SiteTarget,
  entries: Record<string, string>
) {
  return sendMessage("ss-set", { ...target, entries }, topFrame(target.tabId))
}

export function readPageIndexedDB(target: SiteTarget, scope?: IndexedDBScope) {
  return sendMessage(
    "idb-dump",
    { ...target, scope },
    topFrame(target.tabId)
  ).catch((cause) => {
    throw new Error("PAGE_IDB_READ_FAILED", { cause })
  })
}

export function clearPageIndexedDBOnTab(
  target: SiteTarget,
  scope: IndexedDBScope
) {
  return sendMessage("idb-clear", { ...target, scope }, topFrame(target.tabId))
}

export function applyPageIndexedDBOnTab(
  target: SiteTarget,
  snapshot: IndexedDBExport,
  replace: boolean,
  expected: IndexedDBScope
) {
  return sendMessage(
    "idb-apply",
    { ...target, snapshot, replace, expected },
    topFrame(target.tabId)
  )
}

export async function clearSiteState(
  target: SiteTarget,
  captured: readonly ExportedCookie[]
): Promise<number> {
  assertCookiesForSite(target.url, captured)
  for (let i = 0; i < captured.length; i += 8) {
    await assertCurrentTarget(target)
    await Promise.allSettled(
      captured.slice(i, i + 8).map((cookie) =>
        browser.cookies.set({
          ...cookieDetails(target, cookie),
          value: "",
          // Expire the exact domain, path and partition. `remove` takes only
          // a URL and name, so it can select a different cookie at that URL.
          expirationDate: 1,
        })
      )
    )
  }
  // Leave new cookie identities alone; only verify those in the backup.
  const remaining = new Set((await getCookiesForUrl(target)).map(cookieId))
  await sendMessage("site-storage-clear", target, topFrame(target.tabId))
  return captured.filter((cookie) => remaining.has(cookieId(cookie))).length
}