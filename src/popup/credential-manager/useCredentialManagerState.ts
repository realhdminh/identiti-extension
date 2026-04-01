import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  decryptExportEnvelope,
  encryptExportJson,
  type IdentitiEncryptedEnvelope,
  isEncryptedEnvelope,
} from "@/lib/export-crypto"
import {
  filterIndexedDBExport,
  flattenIdbForUi,
  type IndexedDBExport,
} from "@/lib/indexeddb"
import {
  applyPageIndexedDBOnTab,
  type CredentialExportFile,
  cookieRowId,
  EXPORT_SCHEMA_VERSION,
  type ExportedCookie,
  getCookiesForUrl,
  isSupportedWebUrl,
  mergePageIndexedDBOnTab,
  originFromUrl,
  parseExportFile,
  partitionIndexedDBForImport,
  readPageIndexedDB,
  readPageLocalStorage,
  readPageSessionStorage,
  setCookieOnTab,
  writePageLocalStorage,
  writePageSessionStorage,
} from "@/lib/page-credentials"
import {
  type CredentialProfile,
  deleteProfile,
  listProfilesForOrigin,
  loadProfile,
  type ProfileIndexEntry,
  renameProfile,
  saveProfile,
} from "@/lib/profiles"
import { slugForFilename } from "@/popup/lib/format"
import { lsKeyId, ssKeyId } from "@/popup/lib/selection-ids"

export function useCredentialManagerState() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [tabUrl, setTabUrl] = useState<string | undefined>()
  const [tabId, setTabId] = useState<number | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cookies, setCookies] = useState<ExportedCookie[]>([])
  const [lsEntries, setLsEntries] = useState<Record<string, string>>({})
  const [ssEntries, setSsEntries] = useState<Record<string, string>>({})
  const [idbData, setIdbData] = useState<IndexedDBExport>({})
  const [filter, setFilter] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importPayload, setImportPayload] =
    useState<CredentialExportFile | null>(null)
  const [importSelected, setImportSelected] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [encryptExport, setEncryptExport] = useState(false)
  const [exportPass, setExportPass] = useState("")
  const [exportPass2, setExportPass2] = useState("")
  const [importEnvelope, setImportEnvelope] =
    useState<IdentitiEncryptedEnvelope | null>(null)
  const [importDecryptPass, setImportDecryptPass] = useState("")
  const [profiles, setProfiles] = useState<ProfileIndexEntry[]>([])
  const [profileBusy, setProfileBusy] = useState(false)

  const origin =
    tabUrl && isSupportedWebUrl(tabUrl) ? originFromUrl(tabUrl) : null

  const idbRows = useMemo(() => flattenIdbForUi(idbData), [idbData])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    toast.dismiss()
    try {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      })
      const tab = tabs[0]
      if (!tab?.id || !tab.url) {
        setTabUrl(undefined)
        setTabId(undefined)
        setError(browser.i18n.getMessage("noTab"))
        setCookies([])
        setLsEntries({})
        setSsEntries({})
        setIdbData({})
        setSelected(new Set())
        return
      }
      setTabUrl(tab.url)
      setTabId(tab.id)

      if (!isSupportedWebUrl(tab.url)) {
        setError(browser.i18n.getMessage("restrictedPage"))
        setCookies([])
        setLsEntries({})
        setSsEntries({})
        setIdbData({})
        setSelected(new Set())
        return
      }

      const [ck, ls, ss, idb] = await Promise.all([
        getCookiesForUrl(tab.url, tab.id),
        readPageLocalStorage(tab.id).catch(() => ({})),
        readPageSessionStorage(tab.id).catch(() => ({})),
        readPageIndexedDB(tab.id).catch(() => ({}) as IndexedDBExport),
      ])
      const safeLs = ls ?? {}
      const safeSs = ss ?? {}
      const safeIdb = idb ?? {}

      setCookies(ck)
      setLsEntries(safeLs)
      setSsEntries(safeSs)
      setIdbData(safeIdb)

      const next = new Set<string>()
      for (const c of ck) next.add(cookieRowId(c))
      for (const k of Object.keys(safeLs)) next.add(lsKeyId(k))
      for (const k of Object.keys(safeSs)) next.add(ssKeyId(k))
      for (const row of flattenIdbForUi(safeIdb)) next.add(row.id)
      setSelected(next)
    } catch (e) {
      setError(
        browser.i18n.getMessage(
          "loadError",
          e instanceof Error ? e.message : String(e)
        )
      )
      setCookies([])
      setLsEntries({})
      setSsEntries({})
      setIdbData({})
      setSelected(new Set())
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshProfiles = useCallback(async () => {
    if (!origin) {
      setProfiles([])
      return
    }
    try {
      const list = await listProfilesForOrigin(origin)
      setProfiles(list)
    } catch {
      setProfiles([])
    }
  }, [origin])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    void refreshProfiles()
  }, [refreshProfiles])

  const filterLower = filter.trim().toLowerCase()

  const filteredCookies = useMemo(() => {
    if (!filterLower) return cookies
    return cookies.filter(
      (c) =>
        c.name.toLowerCase().includes(filterLower) ||
        c.domain.toLowerCase().includes(filterLower) ||
        c.value.toLowerCase().includes(filterLower)
    )
  }, [cookies, filterLower])

  const filteredLsKeys = useMemo(() => {
    const keys = Object.keys(lsEntries).sort((a, b) => a.localeCompare(b))
    if (!filterLower) return keys
    return keys.filter(
      (k) =>
        k.toLowerCase().includes(filterLower) ||
        lsEntries[k].toLowerCase().includes(filterLower)
    )
  }, [lsEntries, filterLower])

  const filteredSsKeys = useMemo(() => {
    const keys = Object.keys(ssEntries).sort((a, b) => a.localeCompare(b))
    if (!filterLower) return keys
    return keys.filter(
      (k) =>
        k.toLowerCase().includes(filterLower) ||
        ssEntries[k].toLowerCase().includes(filterLower)
    )
  }, [ssEntries, filterLower])

  const filteredIdbRows = useMemo(() => {
    if (!filterLower) return idbRows
    return idbRows.filter(
      (r) =>
        r.database.toLowerCase().includes(filterLower) ||
        r.store.toLowerCase().includes(filterLower) ||
        r.preview.toLowerCase().includes(filterLower) ||
        JSON.stringify(r.key).toLowerCase().includes(filterLower)
    )
  }, [idbRows, filterLower])

  const toggleId = useCallback((id: string, on: boolean) => {
    setSelected((prev) => {
      const n = new Set(prev)
      if (on) n.add(id)
      else n.delete(id)
      return n
    })
  }, [])

  const selectAllIn = useCallback((ids: string[], on: boolean) => {
    setSelected((prev) => {
      const n = new Set(prev)
      for (const id of ids) {
        if (on) n.add(id)
        else n.delete(id)
      }
      return n
    })
  }, [])

  const exportJson = useCallback(async () => {
    if (!origin || !tabUrl) return
    if (encryptExport) {
      if (!exportPass || exportPass !== exportPass2) {
        toast.error(browser.i18n.getMessage("passwordMismatch"))
        return
      }
    }
    const pickCookies = cookies.filter((c) => selected.has(cookieRowId(c)))
    const pickLs: Record<string, string> = {}
    for (const k of Object.keys(lsEntries)) {
      if (selected.has(lsKeyId(k))) pickLs[k] = lsEntries[k]
    }
    const pickSs: Record<string, string> = {}
    for (const k of Object.keys(ssEntries)) {
      if (selected.has(ssKeyId(k))) pickSs[k] = ssEntries[k]
    }
    const pickIdb = filterIndexedDBExport(idbData, selected)
    const anyIdb = Object.keys(pickIdb).length > 0
    if (
      pickCookies.length === 0 &&
      Object.keys(pickLs).length === 0 &&
      Object.keys(pickSs).length === 0 &&
      !anyIdb
    ) {
      toast.error(browser.i18n.getMessage("exportNothingSelected"))
      return
    }
    const payload: CredentialExportFile = {
      identitiVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      origin,
      pageUrl: tabUrl,
      cookies: pickCookies,
      localStorage: pickLs,
      sessionStorage: pickSs,
      indexedDB: pickIdb,
    }
    const json = JSON.stringify(payload, null, 2)
    let outText: string
    let filename: string
    if (encryptExport) {
      const enc = await encryptExportJson(json, exportPass)
      outText = JSON.stringify(enc, null, 2)
      filename = `identiti-${slugForFilename(origin)}-${Date.now()}.encrypted.json`
    } else {
      outText = json
      filename = `identiti-${slugForFilename(origin)}-${Date.now()}.json`
    }
    const blob = new Blob([outText], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toast.success(browser.i18n.getMessage("exportDone"))
  }, [
    origin,
    tabUrl,
    encryptExport,
    exportPass,
    exportPass2,
    cookies,
    selected,
    lsEntries,
    ssEntries,
    idbData,
  ])

  const applyParsedImport = useCallback((data: CredentialExportFile) => {
    setImportPayload(data)
    setImportEnvelope(null)
    const next = new Set<string>()
    for (const c of data.cookies) next.add(cookieRowId(c))
    for (const k of Object.keys(data.localStorage)) next.add(lsKeyId(k))
    for (const k of Object.keys(data.sessionStorage)) next.add(ssKeyId(k))
    for (const row of flattenIdbForUi(data.indexedDB)) next.add(row.id)
    setImportSelected(next)
  }, [])

  const onPickImportFile = useCallback(
    async (f: File | null) => {
      if (!f) return
      toast.dismiss()
      setImportEnvelope(null)
      setImportDecryptPass("")
      try {
        const text = await f.text()
        const raw = JSON.parse(text) as unknown
        if (isEncryptedEnvelope(raw)) {
          setImportEnvelope(raw)
          setImportPayload(null)
          setImportSelected(new Set())
          toast.message(browser.i18n.getMessage("encryptedNeedPassword"))
          return
        }
        const data = parseExportFile(text)
        applyParsedImport(data)
      } catch {
        setImportPayload(null)
        setImportSelected(new Set())
        toast.error(browser.i18n.getMessage("importParseError"))
      }
    },
    [applyParsedImport]
  )

  const decryptAndLoadImport = useCallback(async () => {
    if (!importEnvelope) return
    toast.dismiss()
    try {
      const plain = await decryptExportEnvelope(
        importEnvelope,
        importDecryptPass
      )
      const data = parseExportFile(plain)
      applyParsedImport(data)
      toast.dismiss()
    } catch {
      toast.error(browser.i18n.getMessage("decryptFailed"))
    }
  }, [importEnvelope, importDecryptPass, applyParsedImport])

  const runImport = useCallback(async () => {
    if (
      !importPayload ||
      tabId == null ||
      !tabUrl ||
      !isSupportedWebUrl(tabUrl)
    ) {
      return
    }
    const cookiesToApply = importPayload.cookies.filter((c) =>
      importSelected.has(cookieRowId(c))
    )
    const lsToApply: Record<string, string> = {}
    for (const k of Object.keys(importPayload.localStorage)) {
      if (importSelected.has(lsKeyId(k))) {
        lsToApply[k] = importPayload.localStorage[k]
      }
    }
    const ssToApply: Record<string, string> = {}
    for (const k of Object.keys(importPayload.sessionStorage)) {
      if (importSelected.has(ssKeyId(k))) {
        ssToApply[k] = importPayload.sessionStorage[k]
      }
    }
    const { replace, merge } = partitionIndexedDBForImport(
      importPayload,
      importSelected
    )
    const idbReplaceKeys = Object.keys(replace).length
    const idbMergeKeys = Object.keys(merge).length
    if (
      cookiesToApply.length === 0 &&
      Object.keys(lsToApply).length === 0 &&
      Object.keys(ssToApply).length === 0 &&
      idbReplaceKeys === 0 &&
      idbMergeKeys === 0
    ) {
      toast.error(browser.i18n.getMessage("importNothingSelected"))
      return
    }

    setImportBusy(true)
    setConfirmOpen(false)
    let cookieFail = 0
    try {
      for (const c of cookiesToApply) {
        try {
          await setCookieOnTab(tabUrl, c)
        } catch {
          cookieFail++
        }
      }
      if (Object.keys(lsToApply).length > 0) {
        await writePageLocalStorage(tabId, lsToApply)
      }
      if (Object.keys(ssToApply).length > 0) {
        await writePageSessionStorage(tabId, ssToApply)
      }
      if (idbReplaceKeys > 0) {
        await applyPageIndexedDBOnTab(tabId, replace)
      }
      if (idbMergeKeys > 0) {
        await mergePageIndexedDBOnTab(tabId, merge)
      }
      if (cookieFail > 0) {
        toast.warning(browser.i18n.getMessage("importPartialFail"))
      } else {
        toast.success(browser.i18n.getMessage("importDone"))
      }
      await refresh()
    } catch (e) {
      toast.error(
        browser.i18n.getMessage(
          "loadError",
          e instanceof Error ? e.message : String(e)
        )
      )
    } finally {
      setImportBusy(false)
    }
  }, [importPayload, tabId, tabUrl, importSelected, refresh])

  const saveCurrentAsProfile = useCallback(
    async (name: string) => {
      if (!origin || !tabUrl) return
      setProfileBusy(true)
      try {
        const profile: CredentialProfile = {
          id: crypto.randomUUID(),
          name,
          origin,
          pageUrl: tabUrl,
          savedAt: new Date().toISOString(),
          cookies,
          localStorage: lsEntries,
          sessionStorage: ssEntries,
          indexedDB: idbData,
        }
        await saveProfile(profile)
        await refreshProfiles()
        toast.success(browser.i18n.getMessage("profileSaved"))
      } catch (e) {
        toast.error(
          browser.i18n.getMessage(
            "loadError",
            e instanceof Error ? e.message : String(e)
          )
        )
      } finally {
        setProfileBusy(false)
      }
    },
    [origin, tabUrl, cookies, lsEntries, ssEntries, idbData, refreshProfiles]
  )

  const restoreProfile = useCallback(
    async (profileId: string) => {
      if (tabId == null || !tabUrl || !isSupportedWebUrl(tabUrl)) return
      setProfileBusy(true)
      try {
        const profile = await loadProfile(profileId)
        if (!profile) return
        let cookieFail = 0
        for (const c of profile.cookies) {
          try {
            await setCookieOnTab(tabUrl, c)
          } catch {
            cookieFail++
          }
        }
        if (Object.keys(profile.localStorage).length > 0) {
          await writePageLocalStorage(tabId, profile.localStorage)
        }
        if (Object.keys(profile.sessionStorage).length > 0) {
          await writePageSessionStorage(tabId, profile.sessionStorage)
        }
        const idbKeys = Object.keys(profile.indexedDB)
        if (idbKeys.length > 0) {
          await applyPageIndexedDBOnTab(tabId, profile.indexedDB)
        }
        if (cookieFail > 0) {
          toast.warning(browser.i18n.getMessage("profileRestorePartialFail"))
        } else {
          toast.success(browser.i18n.getMessage("profileRestored"))
        }
        await refresh()
      } catch (e) {
        toast.error(
          browser.i18n.getMessage(
            "loadError",
            e instanceof Error ? e.message : String(e)
          )
        )
      } finally {
        setProfileBusy(false)
      }
    },
    [tabId, tabUrl, refresh]
  )

  const deleteProfileById = useCallback(
    async (profileId: string) => {
      setProfileBusy(true)
      try {
        await deleteProfile(profileId)
        await refreshProfiles()
        toast.success(browser.i18n.getMessage("profileDeleted"))
      } catch (e) {
        toast.error(
          browser.i18n.getMessage(
            "loadError",
            e instanceof Error ? e.message : String(e)
          )
        )
      } finally {
        setProfileBusy(false)
      }
    },
    [refreshProfiles]
  )

  const renameProfileById = useCallback(
    async (profileId: string, name: string) => {
      setProfileBusy(true)
      try {
        await renameProfile(profileId, name)
        await refreshProfiles()
        toast.success(browser.i18n.getMessage("profileRenamed"))
      } catch (e) {
        toast.error(
          browser.i18n.getMessage(
            "loadError",
            e instanceof Error ? e.message : String(e)
          )
        )
      } finally {
        setProfileBusy(false)
      }
    },
    [refreshProfiles]
  )

  const originMismatch = Boolean(
    importPayload && origin && importPayload.origin !== origin
  )

  return {
    fileInputRef,
    tabUrl,
    tabId,
    loading,
    error,
    cookies,
    lsEntries,
    ssEntries,
    idbData,
    filter,
    setFilter,
    selected,
    toggleId,
    selectAllIn,
    refresh,
    exportJson,
    encryptExport,
    setEncryptExport,
    exportPass,
    setExportPass,
    exportPass2,
    setExportPass2,
    importPayload,
    importSelected,
    setImportSelected,
    confirmOpen,
    setConfirmOpen,
    importBusy,
    importEnvelope,
    importDecryptPass,
    setImportDecryptPass,
    onPickImportFile,
    decryptAndLoadImport,
    runImport,
    originMismatch,
    origin,
    filteredCookies,
    filteredLsKeys,
    filteredSsKeys,
    filteredIdbRows,
    idbRows,
    profiles,
    profileBusy,
    saveCurrentAsProfile,
    restoreProfile,
    deleteProfileById,
    renameProfileById,
  }
}