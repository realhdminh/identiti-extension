import {
  applyPageIndexedDB,
  dumpPageIndexedDB,
  mergePageIndexedDBRecords,
} from "@/lib/indexeddb"
import { onMessage } from "@/lib/messaging"

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main(ctx) {
    onMessage("ls-get", () => {
      try {
        const entries: Record<string, string> = {}
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (k) entries[k] = localStorage.getItem(k) ?? ""
        }
        return { ok: true as const, entries }
      } catch (e) {
        return {
          ok: false as const,
          error: e instanceof Error ? e.message : String(e),
        }
      }
    })

    onMessage("ls-set", ({ data }) => {
      try {
        for (const [k, v] of Object.entries(data.entries)) {
          localStorage.setItem(k, v)
        }
        return { ok: true as const }
      } catch (e) {
        return {
          ok: false as const,
          error: e instanceof Error ? e.message : String(e),
        }
      }
    })

    onMessage("ss-get", () => {
      try {
        const entries: Record<string, string> = {}
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i)
          if (k) entries[k] = sessionStorage.getItem(k) ?? ""
        }
        return { ok: true as const, entries }
      } catch (e) {
        return {
          ok: false as const,
          error: e instanceof Error ? e.message : String(e),
        }
      }
    })

    onMessage("ss-set", ({ data }) => {
      try {
        for (const [k, v] of Object.entries(data.entries)) {
          sessionStorage.setItem(k, v)
        }
        return { ok: true as const }
      } catch (e) {
        return {
          ok: false as const,
          error: e instanceof Error ? e.message : String(e),
        }
      }
    })

    onMessage("idb-dump", async () => {
      try {
        const data = await dumpPageIndexedDB()
        return { ok: true as const, data }
      } catch (e) {
        return {
          ok: false as const,
          error: e instanceof Error ? e.message : String(e),
        }
      }
    })

    onMessage("idb-apply", async ({ data }) => {
      try {
        await applyPageIndexedDB(data.snapshot)
        return { ok: true as const }
      } catch (e) {
        return {
          ok: false as const,
          error: e instanceof Error ? e.message : String(e),
        }
      }
    })

    onMessage("idb-merge", async ({ data }) => {
      try {
        await mergePageIndexedDBRecords(data.snapshot)
        return { ok: true as const }
      } catch (e) {
        return {
          ok: false as const,
          error: e instanceof Error ? e.message : String(e),
        }
      }
    })

    ctx.onInvalidated(() => {
      // Extension was updated -- listeners auto-cleaned up by @webext-core/messaging
    })
  },
})