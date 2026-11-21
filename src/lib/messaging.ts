import { defineExtensionMessaging } from "@webext-core/messaging"
import type {
  IndexedDBApplyResult,
  IndexedDBExport,
  IndexedDBScope,
} from "@/lib/indexeddb"

export type PageIdentity = { origin: string; documentToken: string }

type StorageEntries = Record<string, string>

interface ProtocolMap {
  "site-target"(): PageIdentity
  "ls-get"(data: PageIdentity): StorageEntries
  "ls-set"(data: PageIdentity & { entries: StorageEntries }): void
  "ss-get"(data: PageIdentity): StorageEntries
  "ss-set"(data: PageIdentity & { entries: StorageEntries }): void
  "site-storage-clear"(data: PageIdentity): void
  "idb-dump"(data: PageIdentity & { scope?: IndexedDBScope }): IndexedDBExport
  "idb-clear"(data: PageIdentity & { scope: IndexedDBScope }): number
  "idb-apply"(
    data: PageIdentity & {
      snapshot: IndexedDBExport
      replace: boolean
      expected: IndexedDBScope
    }
  ): IndexedDBApplyResult
}

export const { sendMessage, onMessage } =
  defineExtensionMessaging<ProtocolMap>()