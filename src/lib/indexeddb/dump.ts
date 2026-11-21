import { serializeIdbKey, serializeIdbValue } from "./codec"
import { listDatabaseNames, openExistingDb } from "./io"
import type {
  IndexedDBDatabaseDump,
  IndexedDBExport,
  IndexedDBScope,
  IndexedDBStoreDump,
} from "./types"

export async function dumpPageIndexedDB(
  scope?: IndexedDBScope
): Promise<IndexedDBExport> {
  const entries: [string, IndexedDBDatabaseDump][] = []
  for (const name of scope ? Object.keys(scope) : await listDatabaseNames()) {
    const db = await openExistingDb(name)
    if (!db) {
      if (scope) continue
      throw new Error("IDB_DATABASE_CHANGED_DURING_CAPTURE")
    }
    const stores: IndexedDBStoreDump[] = []
    const rows: { key: IDBValidKey; value: unknown }[][] = []
    const version = db.version
    try {
      const names = scope
        ? scope[name]!.stores.filter((store) =>
            db.objectStoreNames.contains(store)
          )
        : Array.from(db.objectStoreNames)
      if (names.length) {
        const tx = db.transaction(names, "readonly")
        void tx.done.catch(() => {})
        for (const name of names) {
          const store = tx.objectStore(name)
          stores.push({
            name,
            keyPath: store.keyPath,
            autoIncrement: store.autoIncrement,
            valueEncoding: "graph",
            indexes: Array.from(store.indexNames, (indexName) => {
              const index = store.index(indexName)
              return {
                name: index.name,
                keyPath: index.keyPath,
                unique: index.unique,
                multiEntry: index.multiEntry,
              }
            }),
            records: [],
          })
          const records: (typeof rows)[number] = []
          for (
            let cursor = await store.openCursor();
            cursor;
            cursor = await cursor.continue()
          ) {
            records.push({ key: cursor.key, value: cursor.value })
          }
          rows.push(records)
        }
        await tx.done
      }
    } finally {
      db.close()
    }
    // Blob reads can outlive the transaction, so encode after the DB is closed.
    for (const [i, store] of stores.entries()) {
      for (const row of rows[i]!) {
        store.records.push({
          key: serializeIdbKey(row.key),
          value: await serializeIdbValue(row.value),
        })
      }
    }
    entries.push([name, { version, stores }])
  }
  return Object.fromEntries(entries)
}