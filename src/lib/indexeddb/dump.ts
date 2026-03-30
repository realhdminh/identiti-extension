import {
  bufToB64,
  deserializeIdbKey,
  isBlobPending,
  serializeIdbKey,
  serializeIdbValueSync,
} from "./codec"
import type { IDBPDatabase } from "./io"
import { openDb } from "./io"
import type { IndexedDBExport, IndexedDBStoreDump } from "./types"

async function readStoreAll(
  db: IDBPDatabase,
  storeName: string
): Promise<{ key: unknown; value: unknown }[]> {
  const records: { key: unknown; value: unknown }[] = []
  const tx = db.transaction(storeName, "readonly")
  const store = tx.objectStore(storeName)
  let cursor = await store.openCursor()
  while (cursor) {
    try {
      records.push({
        key: serializeIdbKey(cursor.key as IDBValidKey),
        value: serializeIdbValueSync(cursor.value),
      })
    } catch {
      /* skip */
    }
    cursor = await cursor.continue()
  }
  await tx.done
  return records
}

function isLegacyBlobSkip(v: unknown): boolean {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as Record<string, unknown>).__idb === "blob_async_only"
  )
}

/**
 * Re-read Blob bodies in separate transactions (cursor tx cannot await arrayBuffer).
 */
async function hydrateBlobPlaceholders(
  snapshot: IndexedDBExport
): Promise<void> {
  for (const [dbName, data] of Object.entries(snapshot)) {
    let db: IDBPDatabase
    try {
      db = await openDb(dbName)
    } catch {
      continue
    }
    try {
      for (const st of data.stores) {
        for (const rec of st.records) {
          if (!isBlobPending(rec.value) && !isLegacyBlobSkip(rec.value)) {
            continue
          }
          const idbKey = deserializeIdbKey(rec.key)
          let raw: unknown
          try {
            raw = await db.get(st.name, idbKey)
          } catch {
            continue
          }
          if (!(raw instanceof Blob)) continue
          try {
            const ab = await raw.arrayBuffer()
            rec.value = {
              __idb: "blob",
              mime: raw.type || "application/octet-stream",
              d: bufToB64(ab),
            }
          } catch {
            /* skip oversized / revoked */
          }
        }
      }
    } finally {
      db.close()
    }
  }
}

export async function dumpPageIndexedDB(): Promise<IndexedDBExport> {
  const out: IndexedDBExport = {}
  const listFn = indexedDB.databases?.bind(indexedDB)
  if (typeof listFn !== "function") {
    return out
  }
  let list: { name?: string; version?: number }[]
  try {
    list = await listFn()
  } catch {
    return out
  }
  for (const meta of list) {
    const name = meta.name
    if (name == null) continue
    let db: IDBPDatabase
    try {
      db = await openDb(name, meta.version)
    } catch {
      try {
        db = await openDb(name)
      } catch {
        continue
      }
    }
    try {
      const stores: IndexedDBStoreDump[] = []
      for (const sn of Array.from(db.objectStoreNames)) {
        const records = await readStoreAll(db, sn)
        stores.push({ name: sn, records })
      }
      out[name] = { version: db.version, stores }
    } finally {
      db.close()
    }
  }
  await hydrateBlobPlaceholders(out)
  return out
}