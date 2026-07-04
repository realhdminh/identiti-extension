import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { storage } from "wxt/utils/storage"
import {
  decryptExportEnvelope,
  encryptExportJson,
  type IdentitiEncryptedEnvelope,
  isEncryptedEnvelope,
} from "@/lib/export-crypto"
import { flattenIdbForUi, type IndexedDBExport } from "@/lib/indexeddb"
import {
  applyPageIndexedDBOnTab,
  type CredentialExportFile,
  cookieRowId,
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
  setCookiesOnTab,
  writePageLocalStorage,
  writePageSessionStorage,
} from "@/lib/page-credentials"
import {
  type CredentialProfile,
  exportAllProfilesBundle,
  listProfilesForOrigin,
  listTrashedProfiles,
  loadProfile,
  type ProfileIndexEntry,
  permanentlyDeleteTrashedProfile,
  renameProfile,
  restoreProfileFromTrash,
  saveProfile,
  trashProfile,
  watchProfileIndex,
  watchProfileTrash,
} from "@/lib/profiles"
import { buildSelectedExportPayload } from "@/popup/lib/build-export-payload"
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
  const [trashedProfiles, setTrashedProfiles] = useState<ProfileIndexEntry[]>(
    []
  )
  const [profileBusy, setProfileBusy] = useState(false)
  const [cryptoBusy, setCryptoBusy] = useState(false)
  const [importFilter, setImportFilter] = useState("")
  const [initialTab, setInitialTab] = useState<string | undefined>()

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
    if (!origin) return
    const unwatch = watchProfileIndex((entries) => {
      setProfiles(entries.filter((p) => p.origin === origin))
    })
    return unwatch
  }, [origin, refreshProfiles])

  const refreshTrashedProfiles = useCallback(async () => {
    if (!origin) {
      setTrashedProfiles([])
      return
    }
    try {
      const list = await listTrashedProfiles(origin)
      setTrashedProfiles(list)
    } catch {
      setTrashedProfiles([])
    }
  }, [origin])

  useEffect(() => {
    void refreshTrashedProfiles()
    if (!origin) return
    return watchProfileTrash((entries) => {
      setTrashedProfiles(entries.filter((p) => p.origin === origin))
    })
  }, [origin, refreshTrashedProfiles])

  useEffect(() => {
    void storage.getItem<string>("session:openTab").then((tab) => {
      if (tab) {
        setInitialTab(tab)
        void storage.removeItem("session:openTab")
      }
    })
  }, [])

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

  const importFilterLower = importFilter.trim().toLowerCase()

  const importFilteredCookies = useMemo(() => {
    if (!importPayload) return []
    if (!importFilterLower) return importPayload.cookies
    return importPayload.cookies.filter(
      (c) =>
        c.name.toLowerCase().includes(importFilterLower) ||
        c.domain.toLowerCase().includes(importFilterLower) ||
        c.value.toLowerCase().includes(importFilterLower)
    )
  }, [importPayload, importFilterLower])

  const importFilteredLsKeys = useMemo(() => {
    if (!importPayload) return []
    const keys = Object.keys(importPayload.localStorage).sort((a, b) =>
      a.localeCompare(b)
    )
    if (!importFilterLower) return keys
    return keys.filter(
      (k) =>
        k.toLowerCase().includes(importFilterLower) ||
        importPayload.localStorage[k].toLowerCase().includes(importFilterLower)
    )
  }, [importPayload, importFilterLower])

  const importFilteredSsKeys = useMemo(() => {
    if (!importPayload) return []
    const keys = Object.keys(importPayload.sessionStorage).sort((a, b) =>
      a.localeCompare(b)
    )
    if (!importFilterLower) return keys
    return keys.filter(
      (k) =>
        k.toLowerCase().includes(importFilterLower) ||
        importPayload.sessionStorage[k]
          .toLowerCase()
          .includes(importFilterLower)
    )
  }, [importPayload, importFilterLower])

  const importIdbRows = useMemo(
    () => (importPayload ? flattenIdbForUi(importPayload.indexedDB) : []),
    [importPayload]
  )

  const importFilteredIdbRows = useMemo(() => {
    if (!importFilterLower) return importIdbRows
    return importIdbRows.filter(
      (r) =>
        r.database.toLowerCase().includes(importFilterLower) ||
        r.store.toLowerCase().includes(importFilterLower) ||
        r.preview.toLowerCase().includes(importFilterLower) ||
        JSON.stringify(r.key).toLowerCase().includes(importFilterLower)
    )
  }, [importIdbRows, importFilterLower])

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
    const payload = buildSelectedExportPayload({
      origin,
      tabUrl,
      cookies,
      lsEntries,
      ssEntries,
      idbData,
      selected,
    })
    if (!payload) {
      toast.error(browser.i18n.getMessage("exportNothingSelected"))
      return
    }
    const json = JSON.stringify(payload, null, 2)
    let outText: string
    let filename: string
    if (encryptExport) {
      setCryptoBusy(true)
      try {
        const enc = await encryptExportJson(json, exportPass)
        outText = JSON.stringify(enc, null, 2)
        filename = `identiti-${slugForFilename(origin)}-${Date.now()}.encrypted.json`
      } finally {
        setCryptoBusy(false)
      }
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

  const copyExportJson = useCallback(async () => {
    if (!origin || !tabUrl || encryptExport) return
    const payload = buildSelectedExportPayload({
      origin,
      tabUrl,
      cookies,
      lsEntries,
      ssEntries,
      idbData,
      selected,
    })
    if (!payload) {
      toast.error(browser.i18n.getMessage("exportNothingSelected"))
      return
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      toast.success(browser.i18n.getMessage("copySuccess"))
    } catch {
      toast.error(browser.i18n.getMessage("loadError", "clipboard"))
    }
  }, [
    origin,
    tabUrl,
    encryptExport,
    cookies,
    selected,
    lsEntries,
    ssEntries,
    idbData,
  ])

  const exportAllProfiles = useCallback(async () => {
    setProfileBusy(true)
    try {
      const bundle = await exportAllProfilesBundle()
      if (bundle.profiles.length === 0) {
        toast.error(browser.i18n.getMessage("profilesEmpty"))
        return
      }
      const outText = JSON.stringify(bundle, null, 2)
      const blob = new Blob([outText], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `identiti-profiles-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(browser.i18n.getMessage("exportAllProfilesDone"))
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
  }, [])

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
    setCryptoBusy(true)
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
    } finally {
      setCryptoBusy(false)
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
    const totalSteps =
      (cookiesToApply.length > 0 ? 1 : 0) +
      (Object.keys(lsToApply).length > 0 ? 1 : 0) +
      (Object.keys(ssToApply).length > 0 ? 1 : 0) +
      (idbReplaceKeys > 0 ? 1 : 0) +
      (idbMergeKeys > 0 ? 1 : 0)
    let step = 0
    try {
      if (cookiesToApply.length > 0) {
        step++
        toast.message(
          browser.i18n.getMessage("importProgress", [
            String(step),
            String(totalSteps),
          ])
        )
        cookieFail = await setCookiesOnTab(tabUrl, cookiesToApply)
      }
      if (Object.keys(lsToApply).length > 0) {
        step++
        toast.message(
          browser.i18n.getMessage("importProgress", [
            String(step),
            String(totalSteps),
          ])
        )
        await writePageLocalStorage(tabId, lsToApply)
      }
      if (Object.keys(ssToApply).length > 0) {
        step++
        toast.message(
          browser.i18n.getMessage("importProgress", [
            String(step),
            String(totalSteps),
          ])
        )
        await writePageSessionStorage(tabId, ssToApply)
      }
      if (idbReplaceKeys > 0) {
        step++
        toast.message(
          browser.i18n.getMessage("importProgress", [
            String(step),
            String(totalSteps),
          ])
        )
        await applyPageIndexedDBOnTab(tabId, replace)
      }
      if (idbMergeKeys > 0) {
        step++
        toast.message(
          browser.i18n.getMessage("importProgress", [
            String(step),
            String(totalSteps),
          ])
        )
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
        const cookieFail = await setCookiesOnTab(tabUrl, profile.cookies)
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

  const trashProfileById = useCallback(
    async (profileId: string) => {
      setProfileBusy(true)
      try {
        await trashProfile(profileId)
        await refreshProfiles()
        await refreshTrashedProfiles()
        toast.success(browser.i18n.getMessage("profileMovedToTrash"))
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
    [refreshProfiles, refreshTrashedProfiles]
  )

  const restoreTrashedProfileById = useCallback(
    async (profileId: string) => {
      setProfileBusy(true)
      try {
        await restoreProfileFromTrash(profileId)
        await refreshProfiles()
        await refreshTrashedProfiles()
        toast.success(browser.i18n.getMessage("profileRestoredFromTrash"))
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
    [refreshProfiles, refreshTrashedProfiles]
  )

  const permanentlyDeleteTrashedProfileById = useCallback(
    async (profileId: string) => {
      setProfileBusy(true)
      try {
        await permanentlyDeleteTrashedProfile(profileId)
        await refreshTrashedProfiles()
        toast.success(browser.i18n.getMessage("profilePermanentlyDeleted"))
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
    [refreshTrashedProfiles]
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
    importFilter,
    setImportFilter,
    selected,
    toggleId,
    selectAllIn,
    refresh,
    exportJson,
    copyExportJson,
    exportAllProfiles,
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
    cryptoBusy,
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
    importFilteredCookies,
    importFilteredLsKeys,
    importFilteredSsKeys,
    importFilteredIdbRows,
    importIdbRows,
    idbRows,
    profiles,
    trashedProfiles,
    profileBusy,
    initialTab,
    saveCurrentAsProfile,
    restoreProfile,
    trashProfileById,
    restoreTrashedProfileById,
    permanentlyDeleteTrashedProfileById,
    renameProfileById,
  }
}