import "@/lib/test-env"
import { describe, expect, test } from "bun:test"
import { splitStoresByLiveSchema } from "@/lib/indexeddb"
import { deserializeIdbValue, serializeIdbValue } from "@/lib/indexeddb/codec"
import {
  assertCookiesForSite,
  cookieSetUrl,
  parseExportFile,
} from "@/lib/page-credentials"
import { isProfilesBundleFile } from "@/lib/profiles"
import { buildExportPayload } from "@/popup/lib/build-export-payload"

describe("cookieSetUrl", () => {
  test("preserves host-only subdomain scope", () => {
    expect(
      cookieSetUrl({
        name: "sid",
        value: "x",
        domain: "api.example.com",
        path: "/",
        secure: true,
        httpOnly: false,
        sameSite: "lax",
        hostOnly: true,
        session: false,
        storeId: "",
      })
    ).toBe("https://api.example.com/")
  })

  test("strips leading dot for domain cookies", () => {
    expect(
      cookieSetUrl({
        name: "sid",
        value: "x",
        domain: ".example.com",
        path: "/app",
        secure: false,
        httpOnly: false,
        sameSite: "lax",
        hostOnly: false,
        session: false,
        storeId: "",
      })
    ).toBe("http://example.com/app")
  })

  test("rejects unrelated private suffix tenants and foreign partition keys", () => {
    const cookie = {
      name: "sid",
      value: "x",
      domain: "other.github.io",
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: "lax" as const,
      hostOnly: true,
      session: true,
      storeId: "source",
    }
    expect(() =>
      assertCookiesForSite("https://my.github.io", [cookie])
    ).toThrow()
    const partitioned = {
      ...cookie,
      partitionKey: { topLevelSite: "https://other.github.io" },
    }
    expect(() =>
      assertCookiesForSite("https://my.github.io", [partitioned])
    ).toThrow()
    assertCookiesForSite("https://my.github.io", [
      {
        ...partitioned,
        partitionKey: { topLevelSite: "https://my.github.io" },
      },
    ])
  })
})

describe("buildExportPayload", () => {
  const cookie = {
    name: "sid",
    value: "secret",
    domain: "example.com",
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "lax" as const,
    hostOnly: true,
    session: false,
    storeId: "0",
  }

  const payloadInput = {
    origin: "https://example.com",
    tabUrl: "https://example.com/",
    cookies: [cookie],
    lsEntries: { token: "ls-token" },
    ssEntries: { cart: "ss-cart" },
    idbData: {
      db1: {
        version: 1,
        stores: [{ name: "s", records: [{ key: "k", value: "v" }] }],
      },
    },
  }

  test("includes cookies, storage and IndexedDB", () => {
    const out = buildExportPayload(payloadInput)
    expect(out).not.toBeNull()
    expect(out?.cookies).toHaveLength(1)
    expect(out?.cookies[0]?.name).toBe("sid")
    expect(out?.localStorage).toEqual({ token: "ls-token" })
    expect(out?.sessionStorage).toEqual({ cart: "ss-cart" })
    const firstStore = out?.indexedDB.db1?.stores[0]
    expect(firstStore?.records.length).toBe(1)
  })

  test("returns null when everything is empty", () => {
    const out = buildExportPayload({
      ...payloadInput,
      cookies: [],
      lsEntries: {},
      ssEntries: {},
      idbData: {},
    })
    expect(out).toBeNull()
  })

  test("does not store the tab URL in the backup file", () => {
    const out = buildExportPayload(payloadInput)
    expect(out).not.toBeNull()
    expect(JSON.stringify(out)).not.toContain("example.com/")
    expect(out?.origin).toBe("https://example.com")
  })
})

describe("assertCookiesForSite", () => {
  const cookie = {
    name: "sid",
    value: "x",
    domain: "example.com",
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "lax" as const,
    hostOnly: true,
    session: true,
    storeId: "0",
  }

  test("accepts a cookie that belongs to the site", () => {
    expect(() =>
      assertCookiesForSite("https://example.com/", [cookie])
    ).not.toThrow()
  })

  test("rejects cookies the destination browser cannot store exactly", () => {
    expect(() =>
      assertCookiesForSite("https://example.com/", [
        { ...cookie, secure: false, sameSite: "no_restriction" as const },
      ])
    ).toThrow()
    expect(() =>
      assertCookiesForSite("https://example.com/", [
        { ...cookie, path: "/café" },
      ])
    ).toThrow()
  })

  test("rejects cookies that belong to another site", () => {
    expect(() =>
      assertCookiesForSite("https://example.com/", [
        { ...cookie, domain: "elsewhere.com" },
      ])
    ).toThrow()
  })

  test("accepts a cookie for a sibling subdomain of the same site", () => {
    expect(() =>
      assertCookiesForSite("https://example.com/", [
        { ...cookie, domain: "other.example.com" },
      ])
    ).not.toThrow()
  })
})

describe("idb value round-trip", () => {
  test("preserves nested structures, typed arrays and maps", async () => {
    const original = {
      n: 42,
      d: new Date("2024-01-02T03:04:05.000Z"),
      buf: new Uint8Array([1, 2, 3]).buffer,
      view: new Uint8Array([4, 5, 6]),
      map: new Map([["a", new Set([1, 2])]]),
      nested: [{ x: "y" }],
      re: /abc/gi,
    }
    const serialized = await serializeIdbValue(original)
    const restored = deserializeIdbValue(serialized) as typeof original
    expect(restored.n).toBe(42)
    expect((restored.d as Date).getTime()).toBe(original.d.getTime())
    const view = restored.view as Uint8Array
    expect(Array.from(view).join(",")).toBe("4,5,6")
    expect(restored.map instanceof Map).toBe(true)
    expect((restored.map as Map<string, Set<number>>).get("a")).toBeInstanceOf(
      Set
    )
    expect((restored.re as RegExp).source).toBe("abc")
    expect((restored.re as RegExp).flags).toBe("gi")
  })

  test("preserves blob bodies", async () => {
    const blob = new Blob(["hello"], { type: "text/plain" })
    const serialized = JSON.parse(
      JSON.stringify(await serializeIdbValue({ b: blob }))
    )
    const restored = deserializeIdbValue(serialized) as { b: Blob }
    expect(restored.b instanceof Blob).toBe(true)
    expect(await restored.b.text()).toBe("hello")
    expect(restored.b.type.startsWith("text/plain")).toBe(true)
  })

  test("preserves cycles, shared views, scalar edge cases and literal __idb keys", async () => {
    const buffer = new Uint8Array([10, 20, 30, 40]).buffer
    const sparse: unknown[] = new Array(3)
    sparse[1] = undefined
    const original = {
      array: sparse,
      number: -0,
      big: 42n,
      __idb: "blob_pending",
      buffer,
      view: new Uint8Array(buffer, 1, 2),
    }
    sparse[2] = original
    Object.defineProperty(original, "__proto__", {
      value: "own",
      enumerable: true,
    })
    const wire = JSON.parse(JSON.stringify(await serializeIdbValue(original)))
    const restored = deserializeIdbValue(wire) as typeof original
    expect(restored.array[2]).toBe(restored)
    expect(0 in restored.array).toBe(false)
    expect(1 in restored.array).toBe(true)
    expect(restored.view.buffer).toBe(restored.buffer)
    expect([...restored.view]).toEqual([20, 30])
    expect(Object.is(restored.number, -0)).toBe(true)
    expect(restored.big).toBe(42n)
    expect(restored.__idb).toBe("blob_pending")
    expect(Object.getOwnPropertyDescriptor(restored, "__proto__")?.value).toBe(
      "own"
    )
  })

  test("legacy files leave literal nested tag objects unchanged", () => {
    const literal = { nested: { __idb: "date", v: 123 } }
    expect(deserializeIdbValue(literal, "legacy")).toEqual(literal)
    expect(deserializeIdbValue(literal, "tagged")).toEqual({
      nested: new Date(123),
    })
  })
})

describe("parseExportFile", () => {
  test("keeps the IndexedDB store schema (keyPath, autoIncrement, indexes)", () => {
    const parsed = parseExportFile(
      JSON.stringify({
        identitiVersion: 3,
        exportedAt: new Date().toISOString(),
        origin: "https://example.com",
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        indexedDB: {
          db1: {
            version: 2,
            stores: [
              {
                name: "inlines",
                keyPath: "id",
                autoIncrement: false,
                indexes: [{ name: "byName", keyPath: "name", unique: false }],
                records: [{ key: 1, value: { id: 1, name: "a" } }],
              },
              {
                name: "outofline",
                keyPath: null,
                autoIncrement: true,
                records: [{ key: 2, value: { x: 1 } }],
              },
            ],
          },
        },
      })
    )
    const stores = parsed.indexedDB.db1?.stores ?? []
    expect(stores[0]?.keyPath).toBe("id")
    expect(stores[0]?.autoIncrement).toBe(false)
    expect(stores[0]?.indexes?.[0]?.name).toBe("byName")
    expect(stores[1]?.keyPath).toBe(null)
    expect(stores[1]?.autoIncrement).toBe(true)
  })
})

describe("splitStoresByLiveSchema", () => {
  const snapshot = [
    { name: "a", records: [{ key: "1", value: "x" }] },
    { name: "b", records: [{ key: "2", value: "y" }] },
  ]

  test("writes the stores the live database has", () => {
    const { writable, missing } = splitStoresByLiveSchema(snapshot, ["a", "b"])
    expect(writable.map((s) => s.name)).toEqual(["a", "b"])
    expect(missing).toHaveLength(0)
  })

  test("never creates a store the live database does not have", () => {
    const { writable, missing } = splitStoresByLiveSchema(snapshot, ["a"])
    expect(writable.map((s) => s.name)).toEqual(["a"])
    expect(missing.map((s) => s.name)).toEqual(["b"])
  })

  test("reports every store as missing when the live schema is unknown", () => {
    const { writable, missing } = splitStoresByLiveSchema(snapshot, [])
    expect(writable).toHaveLength(0)
    expect(missing).toHaveLength(2)
  })
})

describe("isProfilesBundleFile", () => {
  test("accepts valid profiles bundle", () => {
    expect(
      isProfilesBundleFile({
        identitiProfilesBundle: true,
        exportedAt: new Date().toISOString(),
        profiles: [],
      })
    ).toBe(true)
  })

  test("rejects invalid or incomplete shapes", () => {
    expect(isProfilesBundleFile(null)).toBe(false)
    expect(isProfilesBundleFile(undefined)).toBe(false)
    expect(isProfilesBundleFile("string")).toBe(false)
    expect(isProfilesBundleFile({})).toBe(false)
    expect(isProfilesBundleFile({ identitiProfilesBundle: false })).toBe(false)
    expect(
      isProfilesBundleFile({
        identitiProfilesBundle: true,
        profiles: "not an array",
      })
    ).toBe(false)
  })
})