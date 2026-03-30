import { deleteDB, type IDBPDatabase, openDB } from "idb"

export type { IDBPDatabase }

export async function openDb(
  name: string,
  version?: number
): Promise<IDBPDatabase> {
  return openDB(name, version, {
    blocked() {
      throw new Error("IDB open blocked")
    },
  })
}

/** Open at `version` and run `upgrade` (create stores, etc.). */
export async function openDbAtVersion(
  name: string,
  version: number,
  upgrade: (db: IDBPDatabase) => void
): Promise<IDBPDatabase> {
  return openDB(name, version, {
    upgrade(db) {
      upgrade(db)
    },
    blocked() {
      throw new Error("IDB open blocked")
    },
  })
}

export async function deleteDb(name: string): Promise<void> {
  await deleteDB(name, {
    blocked() {
      throw new Error("IDB delete blocked")
    },
  })
}

export async function waitTx(tx: { done: Promise<void> }): Promise<void> {
  await tx.done
}