import { defineExtensionMessaging } from "@webext-core/messaging"
import type { IndexedDBExport } from "@/lib/indexeddb"

type StorageResponse =
  | { ok: true; entries: Record<string, string> }
  | { ok: false; error: string }

type OkResponse = { ok: true } | { ok: false; error: string }

type IdbDumpResponse =
  | { ok: true; data: IndexedDBExport }
  | { ok: false; error: string }

interface ProtocolMap {
  "ls-get"(): StorageResponse
  "ls-set"(data: { entries: Record<string, string> }): OkResponse
  "ss-get"(): StorageResponse
  "ss-set"(data: { entries: Record<string, string> }): OkResponse
  "idb-dump"(): IdbDumpResponse
  "idb-apply"(data: { snapshot: IndexedDBExport }): OkResponse
  "idb-merge"(data: { snapshot: IndexedDBExport }): OkResponse
}

export const { sendMessage, onMessage } =
  defineExtensionMessaging<ProtocolMap>()