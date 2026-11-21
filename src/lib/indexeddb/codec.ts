export function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ""
  for (const b of bytes) {
    s += String.fromCharCode(b)
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
  if (typeof key === "string") return key
  if (typeof key === "number") {
    return Number.isFinite(key) ? key : { __idb: "number", v: String(key) }
  }
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
  throw new Error("BAD_IDB_KEY")
}

export function deserializeIdbKey(data: unknown): IDBValidKey {
  if (typeof data === "number" || typeof data === "string") return data
  if (!data || typeof data !== "object") throw new Error("BAD_IDB_KEY")
  const o = data as Record<string, unknown>
  if (o.__idb === "date" && typeof o.v === "number") return new Date(o.v)
  if (o.__idb === "number" && (o.v === "Infinity" || o.v === "-Infinity")) {
    return Number(o.v)
  }
  if (o.__idb === "ab" && typeof o.d === "string") return b64ToBuf(o.d)
  if (o.__idb === "compound" && Array.isArray(o.v)) {
    return o.v.map((x) => deserializeIdbKey(x)) as IDBValidKey
  }
  if (o.__idb === "str" && typeof o.v === "string") return o.v
  throw new Error("BAD_IDB_KEY")
}

type Encoding = "graph" | "tagged" | "legacy"
type Wire =
  | null
  | boolean
  | number
  | string
  | ["ref", number]
  | ["undefined"]
  | ["number" | "bigint", string]
type Node =
  | ["array", number, [string, Wire][]]
  | ["object", [string, Wire][]]
  | ["map", [Wire, Wire][]]
  | ["set", Wire[]]
  | ["date", number | null]
  | ["regexp", string, string]
  | ["buffer", string]
  | ["view", string, Wire, number, number]
  | ["blob", string, string]
  | ["file", string, string, string, number]
  | ["boxed", Wire]

type ViewConstructor = new (
  buffer: ArrayBuffer,
  offset?: number,
  length?: number
) => ArrayBufferView
const views: Readonly<Record<string, ViewConstructor>> = {
  DataView,
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
  BigInt64Array,
  BigUint64Array,
}

function viewConstructor(name: string): ViewConstructor {
  if (Object.hasOwn(views, name)) return views[name]!
  if (name === "Float16Array" && typeof Float16Array !== "undefined")
    return Float16Array
  throw new Error("UNSUPPORTED_IDB_VIEW")
}

export async function serializeIdbValue(value: unknown) {
  const seen = new WeakMap<object, number>()
  const pending: object[] = []
  const nodes: Node[] = []
  function encode(value: unknown): Wire {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean"
    )
      return value
    if (typeof value === "number") {
      if (Object.is(value, -0)) return ["number", "-0"]
      return Number.isFinite(value) ? value : ["number", String(value)]
    }
    if (value === undefined) return ["undefined"]
    if (typeof value === "bigint") return ["bigint", String(value)]
    if (typeof value !== "object") throw new Error("UNSUPPORTED_IDB_VALUE")
    const previous = seen.get(value)
    if (previous !== undefined) return ["ref", previous]
    const id = pending.length
    seen.set(value, id)
    pending.push(value)
    return ["ref", id]
  }
  const root = encode(value)
  for (const object of pending) {
    let node: Node
    if (Array.isArray(object)) {
      node = [
        "array",
        object.length,
        Object.entries(object).map(([key, item]): [string, Wire] => [
          key,
          encode(item),
        ]),
      ]
    } else if (object instanceof Map) {
      node = [
        "map",
        Array.from(object, ([key, item]) => [encode(key), encode(item)]),
      ]
    } else if (object instanceof Set) {
      node = ["set", Array.from(object, encode)]
    } else if (object instanceof Date) {
      const time = object.getTime()
      node = ["date", Number.isNaN(time) ? null : time]
    } else if (object instanceof RegExp) {
      node = ["regexp", object.source, object.flags]
    } else if (typeof File !== "undefined" && object instanceof File) {
      node = [
        "file",
        bufToB64(await object.arrayBuffer()),
        object.type,
        object.name,
        object.lastModified,
      ]
    } else if (object instanceof Blob) {
      node = ["blob", bufToB64(await object.arrayBuffer()), object.type]
    } else if (object instanceof ArrayBuffer && !object.resizable) {
      node = ["buffer", bufToB64(object)]
    } else if (ArrayBuffer.isView(object)) {
      const ctor = object.constructor.name
      const Constructor = viewConstructor(ctor)
      const size =
        object instanceof DataView
          ? object.byteLength
          : object.byteLength /
            (Constructor as ViewConstructor & { BYTES_PER_ELEMENT: number })
              .BYTES_PER_ELEMENT
      node = ["view", ctor, encode(object.buffer), object.byteOffset, size]
    } else if (
      object instanceof Number ||
      object instanceof Boolean ||
      object instanceof String ||
      Object.getPrototypeOf(object) === BigInt.prototype
    ) {
      node = ["boxed", encode(object.valueOf())]
    } else if (
      Object.getPrototypeOf(object) === Object.prototype ||
      Object.getPrototypeOf(object) === null
    ) {
      node = [
        "object",
        Object.entries(object).map(([key, item]) => [key, encode(item)]),
      ]
    } else {
      // A failed capture must stop an operation, not silently discard data.
      throw new Error("UNSUPPORTED_IDB_VALUE")
    }
    nodes.push(node)
  }
  return { root, nodes }
}

function deserializeGraph(value: unknown): unknown {
  if (
    !value ||
    typeof value !== "object" ||
    !("root" in value) ||
    !("nodes" in value) ||
    !Array.isArray(value.nodes)
  ) {
    throw new Error("BAD_IDB_GRAPH")
  }
  const nodes: Node[] = value.nodes
  const objects: unknown[] = new Array(nodes.length)
  function decode(wire: Wire): unknown {
    if (
      wire === null ||
      typeof wire === "boolean" ||
      typeof wire === "string" ||
      (typeof wire === "number" && Number.isFinite(wire))
    )
      return wire
    if (!Array.isArray(wire)) throw new Error("BAD_IDB_VALUE")
    switch (wire[0]) {
      case "undefined":
        return undefined
      case "number":
        if (["-0", "NaN", "Infinity", "-Infinity"].includes(wire[1]))
          return Number(wire[1])
        break
      case "bigint":
        return BigInt(wire[1])
      case "ref":
        if (
          Number.isSafeInteger(wire[1]) &&
          wire[1] >= 0 &&
          wire[1] < objects.length &&
          objects[wire[1]] !== undefined
        )
          return objects[wire[1]]
    }
    throw new Error("BAD_IDB_VALUE")
  }
  for (const [i, node] of nodes.entries()) {
    switch (node[0]) {
      case "array":
        objects[i] = new Array<unknown>(node[1])
        break
      case "object":
        objects[i] = {}
        break
      case "map":
        objects[i] = new Map()
        break
      case "set":
        objects[i] = new Set()
        break
      case "date":
        objects[i] = new Date(node[1] ?? NaN)
        break
      case "regexp":
        objects[i] = new RegExp(node[1], node[2])
        break
      case "buffer":
        objects[i] = b64ToBuf(node[1])
        break
      case "blob":
        objects[i] = new Blob([b64ToBuf(node[1])], { type: node[2] })
        break
      case "file":
        objects[i] = new File([b64ToBuf(node[1])], node[3], {
          type: node[2],
          lastModified: node[4],
        })
        break
      case "view":
      case "boxed":
        break
      default:
        throw new Error("BAD_IDB_NODE")
    }
  }
  for (const [i, node] of nodes.entries()) {
    if (node[0] === "view") {
      const buffer = decode(node[2])
      if (!(buffer instanceof ArrayBuffer)) throw new Error("BAD_IDB_VIEW")
      objects[i] = new (viewConstructor(node[1]))(buffer, node[3], node[4])
    } else if (node[0] === "boxed") {
      const scalar = decode(node[1])
      if (
        typeof scalar !== "number" &&
        typeof scalar !== "bigint" &&
        typeof scalar !== "boolean" &&
        typeof scalar !== "string"
      )
        throw new Error("BAD_IDB_BOXED")
      objects[i] = Object(scalar)
    }
  }
  for (const [i, node] of nodes.entries()) {
    if (node[0] === "object" || node[0] === "array") {
      const entries = node[0] === "object" ? node[1] : node[2]
      for (const [key, wire] of entries) {
        Object.defineProperty(objects[i], key, {
          value: decode(wire),
          enumerable: true,
          writable: true,
          configurable: true,
        })
      }
    } else if (node[0] === "map") {
      const map = objects[i] as Map<unknown, unknown>
      for (const [key, wire] of node[1]) map.set(decode(key), decode(wire))
    } else if (node[0] === "set") {
      const set = objects[i] as Set<unknown>
      for (const wire of node[1]) set.add(decode(wire))
    }
  }
  return decode(value.root as Wire)
}

export function deserializeIdbValue(
  value: unknown,
  encoding: Encoding = "graph"
): unknown {
  if (encoding === "graph") return deserializeGraph(value)
  if (value == null || typeof value !== "object") return value
  if (Array.isArray(value)) {
    return encoding === "legacy"
      ? value
      : value.map((item) => deserializeIdbValue(item, encoding))
  }
  const o = value as Record<string, unknown>
  if (o.__idb === "date" && typeof o.v === "number") return new Date(o.v)
  if (o.__idb === "ab" && typeof o.d === "string") return b64ToBuf(o.d)
  if (o.__idb === "str" && typeof o.v === "string") return o.v
  if (o.__idb === "blob" && typeof o.d === "string") {
    return new Blob([b64ToBuf(o.d)], {
      type: typeof o.mime === "string" ? o.mime : "",
    })
  }
  if (o.__idb === "blob_pending" || o.__idb === "blob_async_only") {
    throw new Error("IDB_BLOB_BODY_MISSING")
  }
  if (encoding === "legacy") return value
  switch (o.__idb) {
    case "file":
      if (typeof o.d !== "string" || typeof o.name !== "string")
        throw new Error("BAD_IDB_FILE")
      return new File([b64ToBuf(o.d)], o.name, {
        type: typeof o.mime === "string" ? o.mime : "",
        lastModified: typeof o.lastModified === "number" ? o.lastModified : 0,
      })
    case "typed":
      if (typeof o.ctor !== "string" || typeof o.d !== "string")
        throw new Error("BAD_IDB_VIEW")
      return new (viewConstructor(o.ctor))(b64ToBuf(o.d))
    case "dataview":
      if (typeof o.d !== "string") throw new Error("BAD_IDB_VIEW")
      return new DataView(b64ToBuf(o.d))
    case "map":
      if (!Array.isArray(o.v)) throw new Error("BAD_IDB_MAP")
      return new Map(
        o.v.map((entry: unknown) => {
          if (!Array.isArray(entry) || entry.length !== 2)
            throw new Error("BAD_IDB_MAP")
          return [
            deserializeIdbValue(entry[0], encoding),
            deserializeIdbValue(entry[1], encoding),
          ]
        })
      )
    case "set":
      if (!Array.isArray(o.v)) throw new Error("BAD_IDB_SET")
      return new Set(o.v.map((item) => deserializeIdbValue(item, encoding)))
    case "regexp":
      if (typeof o.source !== "string") throw new Error("BAD_IDB_REGEXP")
      return new RegExp(o.source, typeof o.flags === "string" ? o.flags : "")
    default:
      return Object.fromEntries(
        Object.entries(o).map(([key, item]) => [
          key,
          deserializeIdbValue(item, encoding),
        ])
      )
  }
}