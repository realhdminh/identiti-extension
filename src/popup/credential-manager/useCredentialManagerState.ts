import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  decryptExportEnvelope,
  encryptExportJson,
  type IdentitiEncryptedEnvelope,
  isEncryptedEnvelope,
} from "@/lib/export-crypto"
import type { IndexedDBExport, IndexedDBScope } from "@/lib/indexeddb"
import {
  applyPageIndexedDBOnTab,
  assertCookiesForSite,
  type CredentialExportFile,
  clearPageIndexedDBOnTab,
  clearSiteState,
  EXPORT_SCHEMA_VERSION,
  environmentsDiffer,
  getCookiesForUrl,
  isSupportedWebUrl,
  originFromUrl,
  parseExportFile,
  readPageIndexedDB,
  readPageLocalStorage,
  readPageSessionStorage,
  resolveSiteTarget,
  type SiteTarget,
  setCookiesOnTab,
  storeIdForTab,
  writePageLocalStorage,
  writePageSessionStorage,
} from "@/lib/page-credentials"
import {
  type CredentialProfile,
  clearRestoreBackup,
  exportAllProfilesBundle,
  getActiveProfileId,
  hasRestoreBackup,
  importProfilesBundle,
  isProfilesBundleFile,
  listAllProfiles,
  listTrashedProfiles,
  loadProfile,
  loadRestoreBackup,
  type ProfileIndexEntry,
  permanentlyDeleteTrashedProfile,
  type RestoreBackup,
  renameProfile,
  restoreProfileFromTrash,
  saveProfile,
  saveRestoreBackup,
  setActiveProfileId,
  trashProfile,
  watchProfileIndex,
  watchProfileTrash,
} from "@/lib/profiles"
import { buildExportPayload } from "@/popup/lib/build-export-payload"
import { downloadTextFile } from "@/popup/lib/download"
import { slugForFilename } from "@/popup/lib/format"

function operationErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    switch (error.message) {
      case "PAGE_STORAGE_READ_FAILED":
        return browser.i18n.getMessage("storageReadWarning")
      case "PAGE_IDB_READ_FAILED":
        return browser.i18n.getMessage(
          error.cause instanceof Error &&
            error.cause.message === "UNSUPPORTED_IDB_VALUE"
            ? "unsupportedSiteData"
            : "idbReadFailed"
        )
      case "SITE_TARGET_CHANGED":
      case "SITE_ORIGIN_MISMATCH":
        return browser.i18n.getMessage("siteChanged")
      case "COOKIE_OUTSIDE_SITE_OR_INVALID":
        return browser.i18n.getMessage("incompatibleCookies")
    }
  }
  return browser.i18n.getMessage("loadError")
}

function showOperationError(error: unknown) {
  toast.error(operationErrorMessage(error))
}

function currentEnvironment() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screen: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}

type SiteData = Pick<
  CredentialProfile,
  "cookies" | "localStorage" | "sessionStorage" | "indexedDB"
>

async function captureSite(
  target: SiteTarget,
  scope?: IndexedDBScope
): Promise<SiteData> {
  const [cookies, localStorage, sessionStorage, indexedDB] = await Promise.all([
    getCookiesForUrl(target),
    readPageLocalStorage(target),
    readPageSessionStorage(target),
    scope && !Object.keys(scope).length ? {} : readPageIndexedDB(target, scope),
  ])
  return { cookies, localStorage, sessionStorage, indexedDB }
}

function profileFromSite(
  target: SiteTarget,
  name: string,
  data: SiteData
): CredentialProfile {
  return {
    ...data,
    id: crypto.randomUUID(),
    name,
    origin: target.origin,
    snapshotVersion: EXPORT_SCHEMA_VERSION,
    environment: currentEnvironment(),
    savedAt: new Date().toISOString(),
  }
}

function indexedDBScope(snapshot: IndexedDBExport): IndexedDBScope {
  return Object.fromEntries(
    Object.entries(snapshot).map(([name, database]) => [
      name,
      {
        version: database.version,
        stores: database.stores.map((store) => store.name),
      },
    ])
  )
}

async function writeSite(
  target: SiteTarget,
  data: SiteData,
  replace: boolean,
  capturedCookies: SiteData["cookies"],
  expected: IndexedDBScope
) {
  const leftover = replace ? await clearSiteState(target, capturedCookies) : 0
  const cookieFail = await setCookiesOnTab(target, data.cookies)
  if (Object.keys(data.localStorage).length) {
    await writePageLocalStorage(target, data.localStorage)
  }
  if (Object.keys(data.sessionStorage).length) {
    await writePageSessionStorage(target, data.sessionStorage)
  }
  const idb = Object.keys(data.indexedDB).length
    ? await applyPageIndexedDBOnTab(target, data.indexedDB, replace, expected)
    : null
  return {
    complete: cookieFail === 0 && leftover === 0 && !idb?.incomplete,
    createdDatabases: idb?.created,
  }
}

async function reloadTarget(target: SiteTarget) {
  const current = await resolveSiteTarget(target.tabId, target.origin)
  if (current.documentToken === target.documentToken) {
    await browser.tabs.reload(target.tabId)
  }
}

export function useCredentialManagerState() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [tabUrl, setTabUrl] = useState<string | undefined>()
  const [tabId, setTabId] = useState<number | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeStoreId, setActiveStoreId] = useState<string>()
  const [importPayload, setImportPayload] =
    useState<CredentialExportFile | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const operationInFlight = useRef(false)
  const [siteBusy, setSiteBusy] = useState(false)
  const importFileInFlight = useRef(false)
  const [fileBusy, setFileBusy] = useState(false)
  const [importEnvelope, setImportEnvelope] =
    useState<IdentitiEncryptedEnvelope | null>(null)
  const [profiles, setProfiles] = useState<ProfileIndexEntry[]>([])
  const [allProfiles, setAllProfiles] = useState<ProfileIndexEntry[]>([])
  const [trashedProfiles, setTrashedProfiles] = useState<ProfileIndexEntry[]>(
    []
  )
  const [profileBusy, setProfileBusy] = useState(false)
  const [cryptoBusy, setCryptoBusy] = useState(false)
  const [canUndoRestore, setCanUndoRestore] = useState(false)
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(
    null
  )

  const origin =
    tabUrl && isSupportedWebUrl(tabUrl) ? originFromUrl(tabUrl) : null

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    setActiveStoreId(undefined)
    try {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      })
      const tab = tabs[0]
      if (!tab?.id || !tab.url) {
        setTabUrl(undefined)
        setTabId(undefined)
        setActiveStoreId(undefined)
        setError(browser.i18n.getMessage("noTab"))
        return
      }
      setTabUrl(tab.url)
      setTabId(tab.id)

      if (!isSupportedWebUrl(tab.url)) {
        setError(browser.i18n.getMessage("restrictedPage"))
        setActiveStoreId(undefined)
        return
      }

      setActiveStoreId(await storeIdForTab(tab.id))
    } catch (error) {
      setError(operationErrorMessage(error))
      setActiveStoreId(undefined)
    } finally {
      setLoading(false)
    }
  }, [])

  const resolveTarget = useCallback(async () => {
    if (!origin || tabId == null) throw new Error("NO_SITE_TARGET")
    return resolveSiteTarget(tabId, origin)
  }, [origin, tabId])

  const runSiteOperation = useCallback(
    async (operation: (target: SiteTarget) => Promise<void>) => {
      if (
        !origin ||
        tabId == null ||
        operationInFlight.current ||
        importFileInFlight.current
      )
        return
      operationInFlight.current = true
      setSiteBusy(true)
      try {
        // Cookie scope can overlap even across origins in the same browser.
        await navigator.locks.request(
          "identiti:site-operation",
          { ifAvailable: true },
          async (lock) => {
            if (!lock) {
              toast.warning(browser.i18n.getMessage("siteOperationBusy"))
              return
            }
            await operation(await resolveTarget())
          }
        )
      } catch (error) {
        showOperationError(error)
      } finally {
        operationInFlight.current = false
        setSiteBusy(false)
      }
    },
    [origin, tabId, resolveTarget]
  )

  const backupCurrentState = useCallback(
    async (
      target: SiteTarget,
      incoming: IndexedDBExport | undefined
    ): Promise<RestoreBackup | null> => {
      try {
        const data = await captureSite(
          target,
          incoming === undefined ? undefined : indexedDBScope(incoming)
        )
        const backup: RestoreBackup = {
          profile: profileFromSite(
            target,
            browser.i18n.getMessage("safetyBackupName"),
            data
          ),
          activeProfileId: await getActiveProfileId(
            target.origin,
            target.storeId
          ),
        }
        await saveRestoreBackup(target, backup)
        setCanUndoRestore(true)
        return backup
      } catch (error) {
        toast.error(browser.i18n.getMessage("backupFailed"), {
          description: operationErrorMessage(error),
        })
        return null
      }
    },
    []
  )

  const markActive = useCallback(
    async (target: SiteTarget, id: string | null) => {
      await setActiveProfileId(target.origin, target.storeId, id)
      setActiveProfileIdState(id)
    },
    []
  )

  const restoreSite = useCallback(
    async (
      target: SiteTarget,
      data: SiteData & Pick<CredentialProfile, "origin" | "environment">,
      replace: boolean,
      profileId: string | null
    ) => {
      if (data.origin !== target.origin) throw new Error("SITE_ORIGIN_MISMATCH")
      assertCookiesForSite(target.url, data.cookies)
      const backup = await backupCurrentState(target, data.indexedDB)
      if (!backup) return null
      await markActive(target, null)
      if (environmentsDiffer(data.environment, currentEnvironment())) {
        toast.warning(browser.i18n.getMessage("environmentMismatch"))
      }
      const { complete, createdDatabases } = await writeSite(
        target,
        data,
        replace,
        backup.profile.cookies,
        indexedDBScope(backup.profile.indexedDB)
      )
      if (createdDatabases && Object.keys(createdDatabases).length) {
        await saveRestoreBackup(target, { ...backup, createdDatabases })
      }
      if (complete && profileId) await markActive(target, profileId)
      return complete
    },
    [backupCurrentState, markActive]
  )

  const refreshProfiles = useCallback(async () => {
    try {
      const all = await listAllProfiles()
      setAllProfiles(all)
      if (origin) {
        setProfiles(all.filter((p) => p.origin === origin))
      } else {
        setProfiles([])
      }
    } catch {
      setProfiles([])
      setAllProfiles([])
    }
  }, [origin])

  const refreshTrashedProfiles = useCallback(async () => {
    try {
      // Every trashed profile is listed, not just the current origin's: the
      // trash is where profiles go to be restored, wherever they came from.
      setTrashedProfiles(await listTrashedProfiles())
    } catch {
      setTrashedProfiles([])
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    void refreshProfiles()
    const unwatch = watchProfileIndex((entries) => {
      setAllProfiles(entries)
      if (origin) {
        setProfiles(entries.filter((p) => p.origin === origin))
      } else {
        setProfiles([])
      }
    })
    return unwatch
  }, [origin, refreshProfiles])

  useEffect(() => {
    void refreshTrashedProfiles()
    const unwatch = watchProfileTrash((entries) => {
      setTrashedProfiles(entries)
    })
    return unwatch
  }, [refreshTrashedProfiles])

  useEffect(() => {
    setCanUndoRestore(false)
    setActiveProfileIdState(null)
    if (!origin || tabId == null || !activeStoreId) return
    let current = true
    const scope = { origin, tabId, storeId: activeStoreId }
    void Promise.all([
      hasRestoreBackup(scope),
      getActiveProfileId(origin, activeStoreId),
    ])
      .then(([undo, active]) => {
        if (!current || operationInFlight.current) return
        setCanUndoRestore(undo)
        setActiveProfileIdState(active)
      })
      .catch(showOperationError)
    return () => {
      current = false
    }
  }, [origin, tabId, activeStoreId])

  const captureExport = useCallback(async (target: SiteTarget) => {
    const data = await captureSite(target)
    const payload = buildExportPayload({
      origin: target.origin,
      cookies: data.cookies,
      lsEntries: data.localStorage,
      ssEntries: data.sessionStorage,
      idbData: data.indexedDB,
    })
    if (!payload) toast.error(browser.i18n.getMessage("exportNothingSelected"))
    return payload
  }, [])

  const exportJson = useCallback(
    (password?: string) =>
      runSiteOperation(async (target) => {
        const payload = await captureExport(target)
        if (!payload) return
        const json = JSON.stringify(payload, null, 2)
        let output = json
        if (password) {
          setCryptoBusy(true)
          try {
            output = JSON.stringify(
              await encryptExportJson(json, password),
              null,
              2
            )
          } finally {
            setCryptoBusy(false)
          }
        }
        const extension = password ? "encrypted.json" : "json"
        downloadTextFile(
          output,
          `identiti-${slugForFilename(target.origin)}-${Date.now()}.${extension}`
        )
        toast.success(browser.i18n.getMessage("exportDone"))
      }),
    [runSiteOperation, captureExport]
  )

  const copyExportJson = useCallback(
    () =>
      runSiteOperation(async (target) => {
        const payload = await captureExport(target)
        if (!payload) return
        await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
        toast.success(browser.i18n.getMessage("copySuccess"))
      }),
    [runSiteOperation, captureExport]
  )

  const exportAllProfiles = useCallback(async () => {
    setProfileBusy(true)
    try {
      const bundle = await exportAllProfilesBundle()
      if (bundle.profiles.length === 0) {
        toast.error(browser.i18n.getMessage("profilesEmpty"))
        return
      }
      const outText = JSON.stringify(bundle, null, 2)
      downloadTextFile(outText, `identiti-profiles-${Date.now()}.json`)
      toast.success(browser.i18n.getMessage("exportAllProfilesDone"))
    } catch (error) {
      showOperationError(error)
    } finally {
      setProfileBusy(false)
    }
  }, [])

  const importFileText = useCallback(
    async (text: string, raw: unknown) => {
      if (isProfilesBundleFile(raw)) {
        const result = await importProfilesBundle(raw)
        setImportEnvelope(null)
        await refreshProfiles()
        if (result.imported) {
          toast.success(
            browser.i18n.getMessage("profilesBundleImported", [
              String(result.imported),
              String(result.skipped),
            ])
          )
        } else {
          toast.error(browser.i18n.getMessage("importParseError"))
        }
      } else {
        setImportPayload(parseExportFile(text))
        setImportEnvelope(null)
      }
    },
    [refreshProfiles]
  )

  const onPickImportFile = useCallback(
    async (file: File | null) => {
      if (!file || operationInFlight.current || importFileInFlight.current)
        return
      importFileInFlight.current = true
      setFileBusy(true)
      toast.dismiss()
      setImportEnvelope(null)
      setImportPayload(null)
      try {
        const text = await file.text()
        const raw = JSON.parse(text) as unknown
        if (isEncryptedEnvelope(raw)) {
          setImportEnvelope(raw)
          toast.message(browser.i18n.getMessage("encryptedNeedPassword"))
        } else {
          await importFileText(text, raw)
        }
      } catch {
        toast.error(browser.i18n.getMessage("importParseError"))
      } finally {
        importFileInFlight.current = false
        setFileBusy(false)
      }
    },
    [importFileText]
  )

  const decryptAndLoadImport = useCallback(
    async (password: string) => {
      if (
        !importEnvelope ||
        operationInFlight.current ||
        importFileInFlight.current
      )
        return
      importFileInFlight.current = true
      toast.dismiss()
      setCryptoBusy(true)
      try {
        const text = await decryptExportEnvelope(importEnvelope, password)
        await importFileText(text, JSON.parse(text) as unknown)
      } catch {
        toast.error(browser.i18n.getMessage("decryptFailed"))
      } finally {
        importFileInFlight.current = false
        setCryptoBusy(false)
      }
    },
    [importEnvelope, importFileText]
  )

  const runImport = useCallback(async () => {
    if (!importPayload) return
    setConfirmOpen(false)
    await runSiteOperation(async (target) => {
      if (
        !importPayload.cookies.length &&
        !Object.keys(importPayload.localStorage).length &&
        !Object.keys(importPayload.sessionStorage).length &&
        !Object.keys(importPayload.indexedDB).length
      ) {
        toast.error(browser.i18n.getMessage("importNothingSelected"))
        return
      }
      const complete = await restoreSite(
        target,
        importPayload,
        importPayload.identitiVersion === EXPORT_SCHEMA_VERSION,
        null
      )
      if (complete === null) return
      if (complete) {
        setImportPayload(null)
        toast.success(browser.i18n.getMessage("importDone"), {
          action: {
            label: browser.i18n.getMessage("reloadTabNow"),
            onClick: () => void reloadTarget(target).catch(showOperationError),
          },
        })
      } else {
        toast.warning(browser.i18n.getMessage("importPartialFail"))
      }
    })
  }, [importPayload, restoreSite, runSiteOperation])

  const saveCurrentAsProfile = useCallback(
    (name: string) =>
      runSiteOperation(async (target) => {
        const profile = profileFromSite(target, name, await captureSite(target))
        await saveProfile(profile)
        await markActive(target, profile.id)
        await refreshProfiles()
        toast.success(browser.i18n.getMessage("profileSaved"))
      }),
    [markActive, refreshProfiles, runSiteOperation]
  )

  const restoreProfile = useCallback(
    (id: string) =>
      runSiteOperation(async (target) => {
        const profile = await loadProfile(id)
        if (!profile) return
        const complete = await restoreSite(
          target,
          profile,
          profile.snapshotVersion === EXPORT_SCHEMA_VERSION,
          id
        )
        if (complete === null) return
        if (!complete) {
          toast.warning(browser.i18n.getMessage("profileRestorePartialFail"))
          return
        }
        toast.success(browser.i18n.getMessage("profileRestored"), {
          action: {
            label: browser.i18n.getMessage("reloadTabNow"),
            onClick: () => void reloadTarget(target).catch(showOperationError),
          },
        })
      }),
    [restoreSite, runSiteOperation]
  )

  const undoLastRestore = useCallback(
    () =>
      runSiteOperation(async (target) => {
        const backup = await loadRestoreBackup(target)
        if (!backup) {
          setCanUndoRestore(false)
          toast.message(browser.i18n.getMessage("undoUnavailable"))
          return
        }
        const { profile } = backup
        assertCookiesForSite(target.url, profile.cookies)
        const cookies = await getCookiesForUrl(target)
        await markActive(target, null)
        const { complete } = await writeSite(
          target,
          profile,
          true,
          cookies,
          indexedDBScope(profile.indexedDB)
        )
        if (!complete) {
          toast.warning(browser.i18n.getMessage("profileRestorePartialFail"))
          return
        }
        if (backup.createdDatabases) {
          const cleared = await clearPageIndexedDBOnTab(
            target,
            backup.createdDatabases
          )
          if (cleared > 0)
            toast.message(browser.i18n.getMessage("undoSchemaKept"))
        }
        const previous = backup.activeProfileId
        await markActive(
          target,
          previous && (await loadProfile(previous)) ? previous : null
        )
        await clearRestoreBackup(target, profile.id)
        setCanUndoRestore(false)
        toast.success(browser.i18n.getMessage("profileRestored"), {
          action: {
            label: browser.i18n.getMessage("reloadTabNow"),
            onClick: () => void reloadTarget(target).catch(showOperationError),
          },
        })
      }),
    [markActive, runSiteOperation]
  )

  const deleteProfileById = useCallback(
    async (profileId: string) => {
      setProfileBusy(true)
      try {
        await trashProfile(profileId)
        if (activeProfileId === profileId) {
          setActiveProfileIdState(null)
        }
        await refreshProfiles()
        await refreshTrashedProfiles()
        toast.success(browser.i18n.getMessage("profileTrashed"))
      } catch (error) {
        showOperationError(error)
      } finally {
        setProfileBusy(false)
      }
    },
    [activeProfileId, refreshProfiles, refreshTrashedProfiles]
  )

  const restoreTrashedProfileById = useCallback(
    async (profileId: string) => {
      setProfileBusy(true)
      try {
        await restoreProfileFromTrash(profileId)
        await refreshProfiles()
        await refreshTrashedProfiles()
        toast.success(browser.i18n.getMessage("profileRestoredFromTrash"))
      } catch (error) {
        showOperationError(error)
      } finally {
        setProfileBusy(false)
      }
    },
    [refreshProfiles, refreshTrashedProfiles]
  )

  const deleteTrashedProfileForever = useCallback(
    async (profileId: string) => {
      setProfileBusy(true)
      try {
        await permanentlyDeleteTrashedProfile(profileId)
        await refreshTrashedProfiles()
        toast.success(browser.i18n.getMessage("profileDeletedForever"))
      } catch (error) {
        showOperationError(error)
      } finally {
        setProfileBusy(false)
      }
    },
    [refreshTrashedProfiles]
  )

  const deleteAllOtherProfiles = useCallback(async () => {
    setProfileBusy(true)
    try {
      const others = allProfiles.filter((p) => p.origin !== origin)
      for (const p of others) {
        await trashProfile(p.id)
      }
      await refreshProfiles()
      await refreshTrashedProfiles()
      toast.success(browser.i18n.getMessage("profilesDeletedAll"))
    } catch (error) {
      showOperationError(error)
    } finally {
      setProfileBusy(false)
    }
  }, [allProfiles, origin, refreshProfiles, refreshTrashedProfiles])

  const prepareNewLogin = useCallback(
    () =>
      runSiteOperation(async (target) => {
        const backup = await backupCurrentState(target, undefined)
        if (!backup) return
        await markActive(target, null)
        const remaining = await clearSiteState(target, backup.profile.cookies)
        if (Object.keys(backup.profile.indexedDB).length) {
          await clearPageIndexedDBOnTab(
            target,
            indexedDBScope(backup.profile.indexedDB)
          )
        }
        if (remaining) {
          toast.warning(browser.i18n.getMessage("prepareNewLoginPartial"))
        } else {
          toast.success(browser.i18n.getMessage("prepareNewLoginSuccess"))
        }
        await reloadTarget(target)
      }),
    [backupCurrentState, markActive, runSiteOperation]
  )

  const renameProfileById = useCallback(
    async (profileId: string, name: string) => {
      setProfileBusy(true)
      try {
        await renameProfile(profileId, name)
        await refreshProfiles()
        toast.success(browser.i18n.getMessage("profileRenamed"))
      } catch (error) {
        showOperationError(error)
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
    canUndoRestore,
    importPayload,
    confirmOpen,
    setConfirmOpen,
    siteBusy,
    importBusy: siteBusy || fileBusy || profileBusy,
    cryptoBusy,
    importEnvelope,
    onPickImportFile,
    decryptAndLoadImport,
    runImport,
    originMismatch,
    origin,
    profiles,
    allProfiles,
    trashedProfiles,
    activeProfileId,
    profileBusy: profileBusy || siteBusy || fileBusy || cryptoBusy,
    exportJson,
    copyExportJson,
    exportAllProfiles,
    saveCurrentAsProfile,
    restoreProfile,
    prepareNewLogin,
    undoLastRestore,
    deleteProfileById,
    deleteAllOtherProfiles,
    restoreTrashedProfileById,
    deleteTrashedProfileForever,
    renameProfileById,
  }
}