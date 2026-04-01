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

function profileStorageKey(id: string) {
  return `local:profile:${id}` as const
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