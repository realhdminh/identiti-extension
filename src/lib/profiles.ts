import { storage } from "wxt/utils/storage"
import type { IndexedDBExport } from "@/lib/indexeddb"
import type { ExportedCookie } from "@/lib/page-credentials"

export interface CredentialProfile {
  id: string
  name: string
  origin: string
  pageUrl?: string
  savedAt: string
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

const profileIndex = storage.defineItem<ProfileIndexEntry[]>(
  "local:profileIndex",
  { fallback: [] }
)

const profileTrashIndex = storage.defineItem<ProfileIndexEntry[]>(
  "local:profileTrashIndex",
  { fallback: [] }
)

function profileStorageKey(id: string) {
  return `local:profile:${id}` as const
}

function trashStorageKey(id: string) {
  return `local:trash:${id}` as const
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

  await storage.setItem(profileStorageKey(profile.id), profile)

  const index = await profileIndex.getValue()
  const existing = index.findIndex((p) => p.id === profile.id)
  if (existing >= 0) {
    index[existing] = entry
  } else {
    index.unshift(entry)
  }
  await profileIndex.setValue(index)

  return entry
}

export async function loadProfile(
  id: string
): Promise<CredentialProfile | null> {
  return storage.getItem<CredentialProfile>(profileStorageKey(id))
}

export async function deleteProfile(id: string): Promise<void> {
  await storage.removeItem(profileStorageKey(id))
  const index = await profileIndex.getValue()
  await profileIndex.setValue(index.filter((p) => p.id !== id))
}

export async function trashProfile(id: string): Promise<void> {
  const profile = await loadProfile(id)
  if (!profile) return
  const index = await profileIndex.getValue()
  const entry = index.find((p) => p.id === id)
  if (!entry) return

  await storage.setItem(trashStorageKey(id), profile)
  await deleteProfile(id)

  const trash = await profileTrashIndex.getValue()
  if (!trash.some((p) => p.id === id)) {
    trash.unshift(entry)
    await profileTrashIndex.setValue(trash)
  }
}

export async function listTrashedProfiles(
  origin?: string
): Promise<ProfileIndexEntry[]> {
  const all = await profileTrashIndex.getValue()
  return origin ? all.filter((p) => p.origin === origin) : all
}

export async function restoreProfileFromTrash(id: string): Promise<void> {
  const profile = await storage.getItem<CredentialProfile>(trashStorageKey(id))
  if (!profile) return
  await saveProfile(profile)
  await storage.removeItem(trashStorageKey(id))
  const trash = await profileTrashIndex.getValue()
  await profileTrashIndex.setValue(trash.filter((p) => p.id !== id))
}

export async function permanentlyDeleteTrashedProfile(
  id: string
): Promise<void> {
  await storage.removeItem(trashStorageKey(id))
  const trash = await profileTrashIndex.getValue()
  await profileTrashIndex.setValue(trash.filter((p) => p.id !== id))
}

export async function exportAllProfilesBundle(): Promise<ProfilesBundleFile> {
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

export function watchProfileTrash(
  callback: (entries: ProfileIndexEntry[]) => void
): () => void {
  return profileTrashIndex.watch(callback)
}

export async function renameProfile(id: string, name: string): Promise<void> {
  const index = await profileIndex.getValue()
  const entry = index.find((p) => p.id === id)
  if (entry) {
    entry.name = name
    await profileIndex.setValue(index)
  }

  const profile = await loadProfile(id)
  if (profile) {
    profile.name = name
    await storage.setItem(profileStorageKey(id), profile)
  }
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