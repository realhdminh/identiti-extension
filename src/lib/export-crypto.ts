import {
  decryptExportEnvelopeCore,
  encryptExportJsonCore,
  type IdentitiEncryptedEnvelope,
} from "@/lib/export-crypto-core"
import { isRecord } from "@/lib/type-guards"

export type { IdentitiEncryptedEnvelope } from "@/lib/export-crypto-core"

type WorkerRequest =
  | { id: number; op: "encrypt"; plainUtf8: string; password: string }
  | {
      id: number
      op: "decrypt"
      env: IdentitiEncryptedEnvelope
      password: string
    }

type WorkerResponse =
  | { id: number; ok: true; result: IdentitiEncryptedEnvelope | string }
  | { id: number; ok: false; error: string }

let worker: Worker | null | undefined
let nextWorkerId = 0
const pendingWorker = new Map<
  number,
  {
    resolve: (value: IdentitiEncryptedEnvelope | string) => void
    reject: (error: Error) => void
  }
>()

function getCryptoWorker(): Worker | null {
  if (worker !== undefined) return worker
  try {
    worker = new Worker(new URL("./export-crypto.worker.ts", import.meta.url), {
      type: "module",
    })
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data
      const pending = pendingWorker.get(msg.id)
      if (!pending) return
      pendingWorker.delete(msg.id)
      if (msg.ok) pending.resolve(msg.result)
      else pending.reject(new Error(msg.error))
    }
    worker.onerror = () => {
      worker?.terminate()
      worker = null
      for (const [, pending] of pendingWorker) {
        pending.reject(new Error("CRYPTO_WORKER_FAILED"))
      }
      pendingWorker.clear()
    }
    return worker
  } catch {
    worker = null
    return null
  }
}

function runEncryptInWorker(
  plainUtf8: string,
  password: string
): Promise<IdentitiEncryptedEnvelope> {
  const w = getCryptoWorker()
  if (!w) return encryptExportJsonCore(plainUtf8, password)
  const id = nextWorkerId++
  return new Promise((resolve, reject) => {
    pendingWorker.set(id, {
      resolve: (value) => resolve(value as IdentitiEncryptedEnvelope),
      reject,
    })
    w.postMessage({
      id,
      op: "encrypt",
      plainUtf8,
      password,
    } satisfies WorkerRequest)
  })
}

function runDecryptInWorker(
  env: IdentitiEncryptedEnvelope,
  password: string
): Promise<string> {
  const w = getCryptoWorker()
  if (!w) return decryptExportEnvelopeCore(env, password)
  const id = nextWorkerId++
  return new Promise((resolve, reject) => {
    pendingWorker.set(id, {
      resolve: (value) => resolve(value as string),
      reject,
    })
    w.postMessage({
      id,
      op: "decrypt",
      env,
      password,
    } satisfies WorkerRequest)
  })
}

export async function encryptExportJson(
  plainUtf8: string,
  password: string
): Promise<IdentitiEncryptedEnvelope> {
  return runEncryptInWorker(plainUtf8, password)
}

export async function decryptExportEnvelope(
  env: IdentitiEncryptedEnvelope,
  password: string
): Promise<string> {
  return runDecryptInWorker(env, password)
}

export function isEncryptedEnvelope(
  data: unknown
): data is IdentitiEncryptedEnvelope {
  if (!isRecord(data)) return false
  const o = data
  return (
    o.identitiEncrypted === true &&
    typeof o.ciphertextB64 === "string" &&
    typeof o.saltB64 === "string" &&
    typeof o.ivB64 === "string"
  )
}