import {
  decryptExportEnvelopeCore,
  encryptExportJsonCore,
  type IdentitiEncryptedEnvelope,
} from "@/lib/export-crypto-core"

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

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data
  try {
    const result =
      msg.op === "encrypt"
        ? await encryptExportJsonCore(msg.plainUtf8, msg.password)
        : await decryptExportEnvelopeCore(msg.env, msg.password)
    const out: WorkerResponse = { id: msg.id, ok: true, result }
    self.postMessage(out)
  } catch (e) {
    const out: WorkerResponse = {
      id: msg.id,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
    self.postMessage(out)
  }
}