export type IndexedDBStoreDump = {
  name: string
  /** Inline key path, if the store uses in-line keys. */
  keyPath?: string | string[] | null
  autoIncrement?: boolean
  /** Absent on early v3 files, which used recursive tags without references. */
  valueEncoding?: "graph" | "legacy"
  /** Index definitions, recreated on apply. */
  indexes?: {
    name: string
    keyPath: string | string[]
    unique?: boolean
    multiEntry?: boolean
  }[]
  records: { key: unknown; value: unknown }[]
}

export type IndexedDBDatabaseDump = {
  version: number
  stores: IndexedDBStoreDump[]
}

export type IndexedDBExport = Record<string, IndexedDBDatabaseDump>

/** Database and store names only; no records are sent to scope a capture. */
export type IndexedDBScope = Record<
  string,
  { version?: number; stores: string[] }
>

export type IndexedDBApplyResult = {
  applied: number
  skipped: number
  incomplete: boolean
  created: IndexedDBScope
}