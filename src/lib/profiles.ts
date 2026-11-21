import { getDomain } from "tldts"
import { storage } from "wxt/utils/storage"
import type { IndexedDBExport, IndexedDBScope } from "@/lib/indexeddb"
import type {
  EnvironmentSnapshot,
  ExportedCookie,
} from "@/lib/page-credentials"
import { parseExportFile } from "@/lib/page-credentials"
import { isRecord } from "@/lib/type-guards"

export interface CredentialProfile {
  id: string
  name: string
  origin: string
  environment?: EnvironmentSnapshot
  savedAt: string
  snapshotVersion?: 1 | 2 | 3
  cookies: ExportedCookie[]
  localStorage: Record<string, string>
  sessionStorage: Record<string, string>
  indexedDB: IndexedDBExport
}

export interface ProfileIndexEntry {
  id: string
  name: string
  origin: string
  savedAt: string
  counts: {
    cookies: number
    localStorage: number
    sessionStorage: number
    indexedDB: number
  }
}

export type RestoreBackupScope = {
  tabId: number
  origin: string
  storeId: string
}

export type RestoreBackup = {
  profile: CredentialProfile
  activeProfileId: string | null
  createdDatabases?: IndexedDBScope
}

type StoredRestoreBackup = {
  sessionToken: string
  tabId: number
  origin: string
  backup: RestoreBackup
}

const profileIndex = storage.defineItem<ProfileIndexEntry[]>(
  "local:profileIndex",
  { fallback: [] }
)

const profileTrashIndex = storage.defineItem<ProfileIndexEntry[]>(
  "local:profileTrashIndex",
  { fallback: [] }
)

const activeProfiles = storage.defineItem<Record<string, string>>(
  "local:activeProfileByScope",
  { fallback: {} }
)

const restoreBackupSessionKey = "session:restoreBackupToken"

// Popup windows share this lock with other extension contexts.
async function withProfileLock<T>(callback: () => Promise<T>): Promise<T> {
  return navigator.locks.request("identiti:profile-storage", callback)
}

function profileStorageKey(id: string) {
  return `local:profile:${id}` as const
}

function trashStorageKey(id: string) {
  return `local:trash:${id}` as const
}

function restoreBackupKey({ origin, storeId }: RestoreBackupScope) {
  const { hostname } = new URL(origin)
  const site = getDomain(hostname, { allowPrivateDomains: true }) ?? hostname
  // Cookies can be shared across ports, schemes and sibling subdomains.
  return `local:latestRestoreBackup:${JSON.stringify([site, storeId])}` as const
}

function activeProfileKey(origin: string, storeId: string) {
  return JSON.stringify([origin, storeId])
}

async function removeActiveProfileReferencesUnlocked(id: string) {
  const map = await activeProfiles.getValue()
  let changed = false
  for (const key of Object.keys(map)) {
    if (map[key] === id) {
      delete map[key]
      changed = true
    }
  }
  return changed ? [{ item: activeProfiles, value: map }] : []
}

export type ProfilesBundleFile = {
  identitiProfilesBundle: true
  exportedAt: string
  profiles: CredentialProfile[]
}

export async function listAllProfiles(): Promise<ProfileIndexEntry[]> {
  return profileIndex.getValue()
}

export async function listProfilesForOrigin(
  origin: string
): Promise<ProfileIndexEntry[]> {
  const all = await profileIndex.getValue()
  return all.filter((p) => p.origin === origin)
}

export async function saveProfile(
  profile: CredentialProfile
): Promise<ProfileIndexEntry> {
  return withProfileLock(async () => {
    const [index, trash] = await Promise.all([
      profileIndex.getValue(),
      profileTrashIndex.getValue(),
    ])
    if (
      index.some((entry) => entry.id === profile.id) ||
      trash.some((entry) => entry.id === profile.id)
    ) {
      throw new Error("A profile with this ID already exists")
    }
    return saveProfileUnlocked(profile, [...index])
  })
}

async function saveProfileUnlocked(
  profile: CredentialProfile,
  index: ProfileIndexEntry[]
): Promise<ProfileIndexEntry> {
  const entry: ProfileIndexEntry = {
    id: profile.id,
    name: profile.name,
    origin: profile.origin,
    savedAt: profile.savedAt,
    counts: {
      cookies: profile.cookies.length,
      localStorage: Object.keys(profile.localStorage).length,
      sessionStorage: Object.keys(profile.sessionStorage).length,
      indexedDB: Object.values(profile.indexedDB).reduce(
        (sum, db) =>
          sum + db.stores.reduce((s, st) => s + st.records.length, 0),
        0
      ),
    },
  }

  index.unshift(entry)
  try {
    await storage.setItems([
      { key: profileStorageKey(profile.id), value: profile },
      { item: profileIndex, value: index },
    ])
  } catch (error) {
    index.shift()
    throw error
  }

  return entry
}

export async function loadProfile(
  id: string
): Promise<CredentialProfile | null> {
  const profile = await storage.getItem<CredentialProfile>(
    profileStorageKey(id)
  )
  if (!profile || profile.snapshotVersion === 3) return profile
  for (const db of Object.values(profile.indexedDB)) {
    for (const store of db.stores) store.valueEncoding ??= "legacy"
  }
  return profile
}

export async function deleteProfile(id: string): Promise<void> {
  await withProfileLock(async () => {
    const index = await profileIndex.getValue()
    const activeUpdates = await removeActiveProfileReferencesUnlocked(id)
    await storage.setItems([
      { item: profileIndex, value: index.filter((entry) => entry.id !== id) },
      ...activeUpdates,
    ])
    await storage.removeItem(profileStorageKey(id))
  })
}

/**
 * Moves a profile to the trash. The full profile is kept so it can be
 * restored; deleting a saved account is never silently destructive.
 */
export async function trashProfile(id: string): Promise<void> {
  await withProfileLock(() => moveProfileUnlocked(id, true))
}

export async function listTrashedProfiles(
  origin?: string
): Promise<ProfileIndexEntry[]> {
  const all = await profileTrashIndex.getValue()
  return origin ? all.filter((p) => p.origin === origin) : all
}

export async function restoreProfileFromTrash(id: string): Promise<void> {
  await withProfileLock(() => moveProfileUnlocked(id, false))
}

async function moveProfileUnlocked(
  id: string,
  toTrash: boolean
): Promise<void> {
  const sourceIndex = toTrash ? profileIndex : profileTrashIndex
  const destinationIndex = toTrash ? profileTrashIndex : profileIndex
  const sourceKey = toTrash ? profileStorageKey(id) : trashStorageKey(id)
  const destinationKey = toTrash ? trashStorageKey(id) : profileStorageKey(id)
  const [source, destination] = await Promise.all([
    sourceIndex.getValue(),
    destinationIndex.getValue(),
  ])
  const entry = source.find((candidate) => candidate.id === id)
  if (!entry) return
  if (destination.some((candidate) => candidate.id === id)) {
    throw new Error("A profile with this ID already exists at the destination")
  }
  const profile = await storage.getItem<CredentialProfile>(sourceKey)
  if (!profile) throw new Error("The saved profile is missing")

  const activeUpdates = toTrash
    ? await removeActiveProfileReferencesUnlocked(id)
    : []
  // Commit the destination payload and both indexes before dropping the source.
  await storage.setItems([
    { key: destinationKey, value: profile },
    { item: destinationIndex, value: [entry, ...destination] },
    {
      item: sourceIndex,
      value: source.filter((candidate) => candidate.id !== id),
    },
    ...activeUpdates,
  ])
  await storage.removeItem(sourceKey)
}

export async function permanentlyDeleteTrashedProfile(
  id: string
): Promise<void> {
  await withProfileLock(async () => {
    const trash = await profileTrashIndex.getValue()
    await profileTrashIndex.setValue(trash.filter((entry) => entry.id !== id))
    await storage.removeItem(trashStorageKey(id))
  })
}

export function watchProfileTrash(
  callback: (entries: ProfileIndexEntry[]) => void
): () => void {
  return profileTrashIndex.watch(callback)
}

export async function exportAllProfilesBundle(): Promise<ProfilesBundleFile> {
  return navigator.locks.request(
    "identiti:profile-storage",
    { mode: "shared" },
    async () => {
      const index = await profileIndex.getValue()
      const profiles: CredentialProfile[] = []
      for (const entry of index) {
        const profile = await loadProfile(entry.id)
        if (profile) profiles.push(profile)
      }
      return {
        identitiProfilesBundle: true,
        exportedAt: new Date().toISOString(),
        profiles,
      }
    }
  )
}

export function isProfilesBundleFile(
  data: unknown
): data is ProfilesBundleFile {
  if (!isRecord(data)) return false
  const o = data
  if (o.identitiProfilesBundle !== true) return false
  return Array.isArray(o.profiles)
}

export async function importProfilesBundle(
  bundle: ProfilesBundleFile
): Promise<{ imported: number; skipped: number }> {
  return withProfileLock(async () => {
    const [live, trash] = await Promise.all([
      profileIndex.getValue(),
      profileTrashIndex.getValue(),
    ])
    const index = [...live]
    const reservedIds = new Set(live.map((entry) => entry.id))
    for (const entry of trash) reservedIds.add(entry.id)

    let imported = 0
    let skipped = 0
    for (const raw of bundle.profiles) {
      try {
        if (!isRecord(raw)) throw new Error("Invalid profile")
        const savedAt =
          typeof raw.savedAt === "string"
            ? raw.savedAt
            : new Date().toISOString()
        const name = typeof raw.name === "string" ? raw.name.trim() : ""
        const version = raw.snapshotVersion
        const snapshotVersion =
          version === 1 || version === 2 || version === 3 ? version : 2
        const parsed = parseExportFile(
          JSON.stringify({
            identitiVersion: snapshotVersion,
            environment: raw.environment,
            exportedAt: savedAt,
            origin: raw.origin,
            cookies: raw.cookies,
            localStorage: raw.localStorage,
            sessionStorage: raw.sessionStorage,
            indexedDB: raw.indexedDB,
          })
        )
        let id = typeof raw.id === "string" ? raw.id : ""
        while (!id || reservedIds.has(id)) id = crypto.randomUUID()
        await saveProfileUnlocked(
          {
            id,
            name: name || parsed.origin,
            origin: parsed.origin,
            environment: parsed.environment,
            savedAt,
            snapshotVersion,
            cookies: parsed.cookies,
            localStorage: parsed.localStorage,
            sessionStorage: parsed.sessionStorage,
            indexedDB: parsed.indexedDB,
          },
          index
        )
        reservedIds.add(id)
        imported++
      } catch {
        skipped++
      }
    }
    return { imported, skipped }
  })
}

export async function renameProfile(id: string, name: string): Promise<void> {
  await withProfileLock(async () => {
    const index = await profileIndex.getValue()
    const entry = index.find((candidate) => candidate.id === id)
    if (!entry) return
    const profile = await loadProfile(id)
    if (!profile) throw new Error("The saved profile is missing")
    entry.name = name
    profile.name = name
    await storage.setItems([
      { key: profileStorageKey(id), value: profile },
      { item: profileIndex, value: index },
    ])
  })
}

export async function saveRestoreBackup(
  scope: RestoreBackupScope,
  backup: RestoreBackup
): Promise<void> {
  await withProfileLock(async () => {
    let sessionToken = await storage.getItem<string>(restoreBackupSessionKey)
    if (!sessionToken) {
      sessionToken = crypto.randomUUID()
      await storage.setItem(restoreBackupSessionKey, sessionToken)
    }
    await storage.setItem<StoredRestoreBackup>(restoreBackupKey(scope), {
      sessionToken,
      tabId: scope.tabId,
      origin: scope.origin,
      backup,
    })
  })
}

export async function loadRestoreBackup(
  scope: RestoreBackupScope
): Promise<RestoreBackup | null> {
  const sessionToken = await storage.getItem<string>(restoreBackupSessionKey)
  if (!sessionToken) return null
  const stored = await storage.getItem<StoredRestoreBackup>(
    restoreBackupKey(scope)
  )
  return stored?.sessionToken === sessionToken &&
    stored.tabId === scope.tabId &&
    stored.origin === scope.origin
    ? stored.backup
    : null
}

export async function clearRestoreBackup(
  scope: RestoreBackupScope,
  expectedProfileId: string
): Promise<void> {
  await withProfileLock(async () => {
    const backup = await loadRestoreBackup(scope)
    if (backup?.profile.id === expectedProfileId) {
      await storage.removeItem(restoreBackupKey(scope))
    }
  })
}

export async function hasRestoreBackup(
  scope: RestoreBackupScope
): Promise<boolean> {
  return (await loadRestoreBackup(scope)) !== null
}

export async function countProfilesForOrigin(origin: string): Promise<number> {
  const all = await profileIndex.getValue()
  return all.filter((p) => p.origin === origin).length
}

export function watchProfileIndex(
  callback: (entries: ProfileIndexEntry[]) => void
): () => void {
  return profileIndex.watch(callback)
}

export async function getActiveProfileId(
  origin: string,
  storeId: string
): Promise<string | null> {
  const map = await activeProfiles.getValue()
  return map[activeProfileKey(origin, storeId)] ?? null
}

export async function setActiveProfileId(
  origin: string,
  storeId: string,
  profileId: string | null
): Promise<void> {
  await withProfileLock(async () => {
    const key = activeProfileKey(origin, storeId)
    const map = await activeProfiles.getValue()
    if ((map[key] ?? null) === profileId) return
    await activeProfiles.setValue(
      profileId === null
        ? Object.fromEntries(
            Object.entries(map).filter(([storedKey]) => storedKey !== key)
          )
        : { ...map, [key]: profileId }
    )
  })
}