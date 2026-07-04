import { describe, expect, test } from "bun:test"
import {
  decryptExportEnvelopeCore,
  encryptExportJsonCore,
} from "@/lib/export-crypto-core"

describe("export-crypto", () => {
  test("encrypts and decrypts round-trip", async () => {
    const plain = JSON.stringify({
      identitiVersion: 2,
      exportedAt: "2026-01-01T00:00:00.000Z",
      origin: "https://example.com",
      cookies: [],
      localStorage: { token: "abc" },
      sessionStorage: {},
      indexedDB: {},
    })
    const password = "test-password-123"

    const envelope = await encryptExportJsonCore(plain, password)
    expect(envelope.identitiEncrypted).toBe(true)
    expect(envelope.cryptoVersion).toBe(1)

    const decrypted = await decryptExportEnvelopeCore(envelope, password)
    expect(decrypted).toBe(plain)
  })

  test("rejects wrong password", async () => {
    const envelope = await encryptExportJsonCore('{"ok":true}', "correct")
    await expect(decryptExportEnvelopeCore(envelope, "wrong")).rejects.toThrow()
  })
})