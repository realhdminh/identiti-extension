export type IndexedDBStoreDump = {
  name: string
  records: { key: unknown; value: unknown }[]
}

export type IndexedDBDatabaseDump = {
  version: number
  stores: IndexedDBStoreDump[]
}

export type IndexedDBExport = Record<string, IndexedDBDatabaseDump>