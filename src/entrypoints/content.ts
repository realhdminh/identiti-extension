import {
  applyPageIndexedDB,
  clearPageIndexedDB,
  dumpPageIndexedDB,
} from "@/lib/indexeddb"
import { onMessage, type PageIdentity } from "@/lib/messaging"

function readStorage(storage: Storage): Record<string, string> {
  const entries: Record<string, string> = Object.create(null)
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key === null) continue
    const value = storage.getItem(key)
    if (value !== null) entries[key] = value
  }
  return entries
}

function writeStorage(storage: Storage, entries: Record<string, string>) {
  for (const [key, value] of Object.entries(entries))
    storage.setItem(key, value)
}

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main(ctx) {
    const documentToken = crypto.getRandomValues(new Uint32Array(4)).join("-")
    function requireTarget(target: PageIdentity) {
      if (
        target.documentToken !== documentToken ||
        target.origin !== location.origin
      ) {
        throw new Error("SITE_TARGET_CHANGED")
      }
    }

    const off = [
      onMessage("site-target", () => ({
        origin: location.origin,
        documentToken,
      })),
      onMessage("ls-get", ({ data }) => {
        requireTarget(data)
        return readStorage(localStorage)
      }),
      onMessage("ss-get", ({ data }) => {
        requireTarget(data)
        return readStorage(sessionStorage)
      }),
      onMessage("ls-set", ({ data }) => {
        requireTarget(data)
        writeStorage(localStorage, data.entries)
      }),
      onMessage("ss-set", ({ data }) => {
        requireTarget(data)
        writeStorage(sessionStorage, data.entries)
      }),
      onMessage("site-storage-clear", ({ data }) => {
        requireTarget(data)
        const local = localStorage
        const session = sessionStorage
        local.clear()
        session.clear()
      }),
      onMessage("idb-dump", ({ data }) => {
        requireTarget(data)
        return dumpPageIndexedDB(data.scope)
      }),
      onMessage("idb-clear", ({ data }) => {
        requireTarget(data)
        return clearPageIndexedDB(data.scope)
      }),
      onMessage("idb-apply", ({ data }) => {
        requireTarget(data)
        return applyPageIndexedDB(data.snapshot, data.replace, data.expected)
      }),
    ]
    ctx.onInvalidated(() => {
      for (const unsubscribe of off) unsubscribe()
    })
  },
})