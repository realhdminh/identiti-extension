import { idbTag } from "@/lib/type-guards"
import { deserializeIdbKey, deserializeIdbValue } from "./codec"
import type { IDBPDatabase } from "./io"
import { deleteDb, openDb, openDbAtVersion, waitTx } from "./io"
import type { IndexedDBExport } from "./types"

function isSkippablePlaceholder(v: unknown): boolean {
  const tag = idbTag(v)
  return tag === "blob_pending" || tag === "blob_async_only"
}

export async function applyPageIndexedDB(
  snapshot: IndexedDBExport
): Promise<void> {
  for (const [dbName, data] of Object.entries(snapshot)) {
    try {
      await deleteDb(dbName)
    } catch {
      /* ignore */
    }
    const ver = Math.max(1, Math.floor(data.version) || 1)
    const db = await openDbAtVersion(dbName, ver, (database) => {
      for (const st of data.stores) {
        if (!database.objectStoreNames.contains(st.name)) {
          database.createObjectStore(st.name)
        }
      }
    })
    try {
      for (const st of data.stores) {
        if (!db.objectStoreNames.contains(st.name)) continue
        const tx = db.transaction(st.name, "readwrite")
        const store = tx.objectStore(st.name)
        for (const rec of st.records) {
          const dv = deserializeIdbValue(rec.value)
          if (dv === undefined && isSkippablePlaceholder(rec.value)) continue
          if (dv === undefined) continue
          try {
            await store.put(dv, deserializeIdbKey(rec.key))
          } catch {
            /* skip */
          }
        }
        await waitTx(tx)
      }
    } finally {
      db.close()
    }
  }
}

async function upgradeMissingStores(
  dbName: string,
  storeNames: string[]
): Promise<void> {
  let db: IDBPDatabase
  try {
    db = await openDb(dbName)
  } catch {
    return
  }
  const missing = storeNames.filter((n) => !db.objectStoreNames.contains(n))
  const v = db.version
  db.close()
  if (missing.length === 0) return
  const next = await openDbAtVersion(dbName, v + 1, (database) => {
    for (const n of missing) {
      if (!database.objectStoreNames.contains(n)) {
        database.createObjectStore(n)
      }
    }
  })
  next.close()
}

export async function mergePageIndexedDBRecords(
  snapshot: IndexedDBExport
): Promise<void> {
  for (const [dbName, data] of Object.entries(snapshot)) {
    if (data.stores.length === 0) continue
    let db: IDBPDatabase | null = null
    try {
      db = await openDb(dbName)
    } catch {
      await applyPageIndexedDB({ [dbName]: data })
      continue
    }
    const neededStores = [...new Set(data.stores.map((s) => s.name))]
    db.close()
    await upgradeMissingStores(dbName, neededStores)
    db = await openDb(dbName)
    try {
      for (const st of data.stores) {
        if (!db.objectStoreNames.contains(st.name)) continue
        const tx = db.transaction(st.name, "readwrite")
        const store = tx.objectStore(st.name)
        for (const rec of st.records) {
          const dv = deserializeIdbValue(rec.value)
          if (dv === undefined && isSkippablePlaceholder(rec.value)) continue
          if (dv === undefined) continue
          try {
            await store.put(dv, deserializeIdbKey(rec.key))
          } catch {
            /* skip */
          }
        }
        await waitTx(tx)
      }
    } finally {
      db.close()
    }
  }
}