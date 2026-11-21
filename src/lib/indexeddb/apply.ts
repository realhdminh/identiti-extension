import { deserializeIdbKey, deserializeIdbValue } from "./codec"
import { createDb, type IDBPDatabase, openExistingDb } from "./io"
import type {
  IndexedDBApplyResult,
  IndexedDBExport,
  IndexedDBScope,
  IndexedDBStoreDump,
} from "./types"

type Row = { key: IDBValidKey; value: unknown }
type WritableStore = {
  keyPath: string | string[] | null
  put(value: unknown, key?: IDBValidKey): Promise<IDBValidKey>
  clear(): Promise<void>
}
type PreparedStore = { schema: IndexedDBStoreDump; rows: Row[] }

function prepareStore(schema: IndexedDBStoreDump): PreparedStore {
  const rows = schema.records.map((row) => {
    const key = deserializeIdbKey(row.key)
    indexedDB.cmp(key, key)
    return {
      key,
      value: deserializeIdbValue(row.value, schema.valueEncoding ?? "tagged"),
    }
  })
  // Reject duplicate keys instead of claiming both records were restored.
  const keys = rows.map((row) => row.key).sort((a, b) => indexedDB.cmp(a, b))
  for (let i = 1; i < keys.length; i++) {
    if (indexedDB.cmp(keys[i - 1]!, keys[i]!) === 0) {
      throw new Error("IDB_DUPLICATE_KEY")
    }
  }
  return { schema, rows }
}

async function writeRows(store: WritableStore, rows: Row[]) {
  for (const { key, value } of rows) {
    const written =
      store.keyPath === null
        ? await store.put(value, key)
        : await store.put(value)
    if (indexedDB.cmp(written, key) !== 0)
      throw new Error("IDB_INLINE_KEY_MISMATCH")
  }
}

function validateStore(store: WritableStore, schema: IndexedDBStoreDump) {
  if (
    schema.keyPath !== undefined &&
    JSON.stringify(store.keyPath) !== JSON.stringify(schema.keyPath)
  ) {
    throw new Error("IDB_KEY_PATH_CHANGED")
  }
}

function recordCount(stores: IndexedDBStoreDump[]): number {
  return stores.reduce((count, store) => count + store.records.length, 0)
}

function abortTransaction(tx: { abort(): void }) {
  try {
    tx.abort()
  } catch {
    // The failing request may have already aborted the transaction.
  }
}

/**
 * Splits the snapshot's stores into the ones the live database has and the
 * ones it does not.
 *
 * A store that only exists in the snapshot is never created: adding a store
 * requires a version bump, which would skip the site's own upgrade
 * migrations. Its records are reported as skipped instead.
 */
export function splitStoresByLiveSchema(
  snapshot: IndexedDBStoreDump[],
  liveStoreNames: string[]
): { writable: IndexedDBStoreDump[]; missing: IndexedDBStoreDump[] } {
  const live = new Set(liveStoreNames)
  const writable: IndexedDBStoreDump[] = []
  const missing: IndexedDBStoreDump[] = []
  for (const st of snapshot) {
    if (live.has(st.name)) {
      writable.push(st)
    } else {
      missing.push(st)
    }
  }
  return { writable, missing }
}

export async function applyPageIndexedDB(
  snapshot: IndexedDBExport,
  replace = true,
  expected?: IndexedDBScope
): Promise<IndexedDBApplyResult> {
  let applied = 0
  let skipped = 0
  let incomplete = false
  const created: IndexedDBScope = Object.create(null)

  for (const [name, database] of Object.entries(snapshot)) {
    if (!database.stores.length) continue
    let db: IDBPDatabase | null = null
    let writable = database.stores
    try {
      db = await openExistingDb(name)
      if (expected) {
        const backedUp = Object.hasOwn(expected, name)
          ? expected[name]
          : undefined
        const liveStores = db?.objectStoreNames
        if (
          db?.version !== backedUp?.version ||
          (liveStores &&
            writable.some(
              (store) =>
                liveStores.contains(store.name) !==
                backedUp?.stores.includes(store.name)
            ))
        ) {
          throw new Error("IDB_SCHEMA_CHANGED")
        }
      }
      if (db) {
        const split = splitStoresByLiveSchema(
          writable,
          Array.from(db.objectStoreNames)
        )
        writable = split.writable
        if (split.missing.length) {
          incomplete = true
          skipped += recordCount(split.missing)
        }
      }
      if (!writable.length) continue
      const prepared = writable.map(prepareStore)
      if (!db) {
        db = await createDb(
          name,
          database.version,
          (created, _old, _new, tx) => {
            void tx.done.catch(() => {})
            const stores = prepared.map(({ schema, rows }) => {
              const store = created.createObjectStore(schema.name, {
                keyPath: schema.keyPath ?? null,
                autoIncrement: schema.autoIncrement === true,
              })
              for (const index of schema.indexes ?? []) {
                store.createIndex(index.name, index.keyPath, {
                  unique: index.unique,
                  multiEntry: index.multiEntry,
                })
              }
              return { store, rows }
            })
            // The database open resolves only after this upgrade commits.
            void Promise.all(
              stores.map(({ store, rows }) => writeRows(store, rows))
            ).catch(() => abortTransaction(tx))
          }
        )
        created[name] = {
          version: db.version,
          stores: writable.map((store) => store.name),
        }
      } else {
        const tx = db.transaction(
          writable.map((store) => store.name),
          "readwrite"
        )
        void tx.done.catch(() => {})
        try {
          for (const { schema, rows } of prepared) {
            const store = tx.objectStore(schema.name)
            validateStore(store, schema)
            if (replace) await store.clear()
            await writeRows(store, rows)
          }
          await tx.done
        } catch (error) {
          abortTransaction(tx)
          await tx.done.catch(() => {})
          throw error
        }
      }
      applied += recordCount(writable)
    } catch {
      incomplete = true
      skipped += recordCount(writable)
    } finally {
      db?.close()
    }
  }
  return { applied, skipped, incomplete, created }
}

/** Clears only backed-up stores, leaving database versions and schemas intact. */
export async function clearPageIndexedDB(
  scope: IndexedDBScope
): Promise<number> {
  let cleared = 0
  for (const [name, { version, stores }] of Object.entries(scope)) {
    const db = await openExistingDb(name)
    if (!db) continue
    try {
      if (
        db.version !== version ||
        stores.some((store) => !db.objectStoreNames.contains(store))
      ) {
        throw new Error("IDB_SCHEMA_CHANGED")
      }
      if (stores.length === 0) continue
      const tx = db.transaction(stores, "readwrite")
      void tx.done.catch(() => {})
      try {
        for (const store of stores) await tx.objectStore(store).clear()
        await tx.done
      } catch (error) {
        abortTransaction(tx)
        await tx.done.catch(() => {})
        throw error
      }
      cleared++
    } finally {
      db.close()
    }
  }
  return cleared
}