import { isRecord } from "@/lib/type-guards"

const PBKDF2_ITERATIONS = 250_000
const SALT_BYTES = 16
const IV_BYTES = 12

export type IdentitiEncryptedEnvelope = {
  identitiEncrypted: true
  cryptoVersion: 1
  kdf: "PBKDF2"
  prf: "SHA-256"
  iterations: number
  saltB64: string
  ivB64: string
  ciphertextB64: string
}

function bytesToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ""
  for (let i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i])
  }
  return btoa(s)
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function encryptExportJson(
  plainUtf8: string,
  password: string
): Promise<IdentitiEncryptedEnvelope> {
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt.buffer.slice(
        salt.byteOffset,
        salt.byteOffset + salt.byteLength
      ) as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  )
  const aesKey = await crypto.subtle.importKey(
    "raw",
    bits,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  )
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv.buffer.slice(
        iv.byteOffset,
        iv.byteOffset + iv.byteLength
      ) as ArrayBuffer,
    },
    aesKey,
    enc.encode(plainUtf8)
  )
  return {
    identitiEncrypted: true,
    cryptoVersion: 1,
    kdf: "PBKDF2",
    prf: "SHA-256",
    iterations: PBKDF2_ITERATIONS,
    saltB64: bytesToB64(salt.buffer),
    ivB64: bytesToB64(iv.buffer),
    ciphertextB64: bytesToB64(ciphertext),
  }
}

export async function decryptExportEnvelope(
  env: IdentitiEncryptedEnvelope,
  password: string
): Promise<string> {
  if (
    env.cryptoVersion !== 1 ||
    env.kdf !== "PBKDF2" ||
    env.prf !== "SHA-256"
  ) {
    throw new Error("CRYPTO_UNSUPPORTED")
  }
  const enc = new TextEncoder()
  const salt = b64ToBytes(env.saltB64)
  const iv = b64ToBytes(env.ivB64)
  const cipherRaw = b64ToBytes(env.ciphertextB64)
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt.buffer.slice(
        salt.byteOffset,
        salt.byteOffset + salt.byteLength
      ) as ArrayBuffer,
      iterations: env.iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  )
  const aesKey = await crypto.subtle.importKey(
    "raw",
    bits,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  )
  const plain = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv.buffer.slice(
        iv.byteOffset,
        iv.byteOffset + iv.byteLength
      ) as ArrayBuffer,
    },
    aesKey,
    cipherRaw.buffer.slice(
      cipherRaw.byteOffset,
      cipherRaw.byteOffset + cipherRaw.byteLength
    ) as ArrayBuffer
  )
  return new TextDecoder().decode(plain)
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