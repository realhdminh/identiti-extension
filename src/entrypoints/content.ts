import {
  applyPageIndexedDB,
  dumpPageIndexedDB,
  mergePageIndexedDBRecords,
} from "@/lib/indexeddb"
import {
  isMessageIdbApply,
  isMessageIdbMerge,
  isMessageLsSet,
  isMessageSsSet,
  MESSAGE_IDB_DUMP,
  MESSAGE_LS_GET,
  MESSAGE_SS_GET,
} from "@/lib/page-credentials"

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === MESSAGE_LS_GET) {
        try {
          const entries: Record<string, string> = {}
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i)
            if (k) entries[k] = localStorage.getItem(k) ?? ""
          }
          sendResponse({ ok: true, entries })
        } catch (e) {
          sendResponse({
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          })
        }
        return true
      }

      if (isMessageLsSet(message)) {
        const { entries } = message
        try {
          for (const [k, v] of Object.entries(entries)) {
            localStorage.setItem(k, v)
          }
          sendResponse({ ok: true })
        } catch (e) {
          sendResponse({
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          })
        }
        return true
      }

      if (message?.type === MESSAGE_SS_GET) {
        try {
          const entries: Record<string, string> = {}
          for (let i = 0; i < sessionStorage.length; i++) {
            const k = sessionStorage.key(i)
            if (k) entries[k] = sessionStorage.getItem(k) ?? ""
          }
          sendResponse({ ok: true, entries })
        } catch (e) {
          sendResponse({
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          })
        }
        return true
      }

      if (isMessageSsSet(message)) {
        const { entries } = message
        try {
          for (const [k, v] of Object.entries(entries)) {
            sessionStorage.setItem(k, v)
          }
          sendResponse({ ok: true })
        } catch (e) {
          sendResponse({
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          })
        }
        return true
      }

      if (message?.type === MESSAGE_IDB_DUMP) {
        void dumpPageIndexedDB()
          .then((data) => {
            sendResponse({ ok: true, data })
          })
          .catch((e) => {
            sendResponse({
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            })
          })
        return true
      }

      if (isMessageIdbApply(message)) {
        const { snapshot } = message
        void applyPageIndexedDB(snapshot)
          .then(() => {
            sendResponse({ ok: true })
          })
          .catch((e) => {
            sendResponse({
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            })
          })
        return true
      }

      if (isMessageIdbMerge(message)) {
        const { snapshot } = message
        void mergePageIndexedDBRecords(snapshot)
          .then(() => {
            sendResponse({ ok: true })
          })
          .catch((e) => {
            sendResponse({
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            })
          })
        return true
      }

      return undefined
    })
  },
})