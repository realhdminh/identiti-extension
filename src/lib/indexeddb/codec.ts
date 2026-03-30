import type { IndexedDBExport, IndexedDBStoreDump } from "./types"

export function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ""
  for (let i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i])
  }
  return btoa(s)
}

export function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

export function serializeIdbKey(key: IDBValidKey): unknown {
  if (typeof key === "number" || typeof key === "string") return key
  if (key instanceof Date) return { __idb: "date", v: key.getTime() }
  if (key instanceof ArrayBuffer) {
    return { __idb: "ab", d: bufToB64(key) }
  }
  if (ArrayBuffer.isView(key)) {
    const v = key as ArrayBufferView
    const slice = v.buffer.slice(
      v.byteOffset,
      v.byteOffset + v.byteLength
    ) as ArrayBuffer
    return { __idb: "ab", d: bufToB64(slice) }
  }
  if (Array.isArray(key)) {
    return {
      __idb: "compound",
      v: key.map((k) => serializeIdbKey(k as IDBValidKey)),
    }
  }
  return { __idb: "str", v: String(key) }
}

export function deserializeIdbKey(data: unknown): IDBValidKey {
  if (typeof data === "number" || typeof data === "string") return data
  if (!data || typeof data !== "object") return String(data)
  const o = data as Record<string, unknown>
  if (o.__idb === "date" && typeof o.v === "number") return new Date(o.v)
  if (o.__idb === "ab" && typeof o.d === "string") return b64ToBuf(o.d)
  if (o.__idb === "compound" && Array.isArray(o.v)) {
    return o.v.map((x) => deserializeIdbKey(x)) as IDBValidKey
  }
  if (o.__idb === "str" && typeof o.v === "string") return o.v
  return JSON.stringify(data)
}

const BLOB_PENDING = "blob_pending" as const

/** First pass inside cursor tx — Blob replaced in hydrate pass. */
export function serializeIdbValueSync(v: unknown): unknown {
  if (v == null) return v
  const t = typeof v
  if (t === "string" || t === "number" || t === "boolean") return v
  if (v instanceof Date) return { __idb: "date", v: v.getTime() }
  if (v instanceof Blob) {
    return {
      __idb: BLOB_PENDING,
      size: v.size,
      mime: v.type || "application/octet-stream",
    }
  }
  if (v instanceof ArrayBuffer) {
    return { __idb: "ab", d: bufToB64(v) }
  }
  if (ArrayBuffer.isView(v)) {
    const view = v as ArrayBufferView
    const slice = view.buffer.slice(
      view.byteOffset,
      view.byteOffset + view.byteLength
    ) as ArrayBuffer
    return { __idb: "ab", d: bufToB64(slice) }
  }
  try {
    JSON.stringify(v)
    return v
  } catch {
    return { __idb: "str", v: String(v) }
  }
}

export function isBlobPending(v: unknown): boolean {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as Record<string, unknown>).__idb === BLOB_PENDING
  )
}

export function deserializeIdbValue(v: unknown): unknown {
  if (v == null) return v
  if (typeof v !== "object") return v
  const o = v as Record<string, unknown>
  if (o.__idb === "date" && typeof o.v === "number") return new Date(o.v)
  if (o.__idb === "blob" && typeof o.d === "string") {
    const mime =
      typeof o.mime === "string" ? o.mime : "application/octet-stream"
    return new Blob([b64ToBuf(o.d)], { type: mime })
  }
  if (o.__idb === "ab" && typeof o.d === "string") return b64ToBuf(o.d)
  if (o.__idb === "str" && typeof o.v === "string") return o.v
  if (o.__idb === BLOB_PENDING || o.__idb === "blob_async_only") {
    return undefined
  }
  return v
}

export function idbRecordId(
  database: string,
  store: string,
  key: unknown
): string {
  return `idb:${database}|${store}|${JSON.stringify(key)}`
}

export function filterIndexedDBExport(
  full: IndexedDBExport,
  selectedIds: Set<string>
): IndexedDBExport {
  const out: IndexedDBExport = {}
  for (const [dbName, data] of Object.entries(full)) {
    const stores: IndexedDBStoreDump[] = []
    for (const st of data.stores) {
      const recs = st.records.filter((r) =>
        selectedIds.has(idbRecordId(dbName, st.name, r.key))
      )
      if (recs.length > 0) {
        stores.push({ name: st.name, records: recs })
      }
    }
    if (stores.length > 0) {
      out[dbName] = { version: data.version, stores }
    }
  }
  return out
}

export function flattenIdbForUi(data: IndexedDBExport): {
  id: string
  database: string
  store: string
  key: unknown
  preview: string
}[] {
  const rows: {
    id: string
    database: string
    store: string
    key: unknown
    preview: string
  }[] = []
  for (const [dbName, db] of Object.entries(data)) {
    for (const st of db.stores) {
      for (const rec of st.records) {
        const id = idbRecordId(dbName, st.name, rec.key)
        let preview = ""
        try {
          preview = JSON.stringify(rec.value).slice(0, 80)
        } catch {
          preview = "…"
        }
        rows.push({
          id,
          database: dbName,
          store: st.name,
          key: rec.key,
          preview,
        })
      }
    }
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id))
}