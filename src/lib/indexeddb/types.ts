export type IndexedDBStoreDump = {
  name: string
  records: { key: unknown; value: unknown }[]
}

export type IndexedDBDatabaseDump = {
  version: number
  stores: IndexedDBStoreDump[]
}

export type IndexedDBExport = Record<string, IndexedDBDatabaseDump>

/** Lightweight listing of live databases/stores, used to pick safe apply mode. */
export type IndexedDBMeta = Record<string, { version: number; stores: string[] }>