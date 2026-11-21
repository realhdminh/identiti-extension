import { type IDBPDatabase, type OpenDBCallbacks, openDB } from "idb"

export type { IDBPDatabase }

type Upgrade = NonNullable<OpenDBCallbacks<unknown>["upgrade"]>

async function openWithoutWaiting(
  name: string,
  version: number | undefined,
  upgrade: Upgrade
) {
  let blocked = false
  const gate = Promise.withResolvers<never>()
  const pending = openDB(name, version, {
    upgrade(db, oldVersion, newVersion, tx, event) {
      if (blocked) {
        tx.abort()
        return
      }
      try {
        upgrade(db, oldVersion, newVersion, tx, event)
      } catch {
        tx.abort()
      }
    },
    blocked() {
      blocked = true
      gate.reject(new Error("IDB_BLOCKED"))
    },
    blocking(_version, _newVersion, event) {
      if (event.target instanceof IDBDatabase) event.target.close()
    },
  })
  return Promise.race([
    pending.then((db) => {
      if (blocked) db.close()
      return db
    }),
    gate.promise,
  ])
}

export async function openExistingDb(
  name: string
): Promise<IDBPDatabase | null> {
  let missing = false
  try {
    return await openWithoutWaiting(name, undefined, (_db, _old, _new, tx) => {
      missing = true
      tx.abort()
    })
  } catch (error) {
    if (missing) return null
    throw error
  }
}

export async function createDb(
  name: string,
  version: number,
  upgrade: Upgrade
) {
  let created = false
  const db = await openWithoutWaiting(
    name,
    version,
    (db, oldVersion, newVersion, tx, event) => {
      if (oldVersion !== 0) {
        tx.abort()
        return
      }
      upgrade(db, oldVersion, newVersion, tx, event)
      created = true
    }
  )
  if (!created) {
    db.close()
    throw new Error("IDB_SCHEMA_CHANGED")
  }
  return db
}

export async function listDatabaseNames(): Promise<string[]> {
  if (typeof indexedDB.databases !== "function") {
    throw new Error("IDB_DATABASE_LIST_UNAVAILABLE")
  }
  return (await indexedDB.databases()).map(({ name }) => {
    if (name === undefined) throw new Error("IDB_DATABASE_NAME_UNAVAILABLE")
    return name
  })
}