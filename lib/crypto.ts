/**
 * AES-256-GCM encryption for supplier credentials.
 * Keys are server-side only — never sent to the client.
 *
 * Format: "v2:<base64(iv:tag:ciphertext)>" — versioned so we can detect and
 * re-encrypt any legacy XOR rows (prefixed "v1:" or no prefix) on read.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHmac } from "crypto";

const ALG = "aes-256-gcm";
const IV_LEN = 12;  // 96-bit IV recommended for GCM
const TAG_LEN = 16; // 128-bit auth tag

function getKey(): Buffer {
  const secret = process.env.CREDENTIAL_SECRET ?? "dentago-secret-key-change-in-prod";
  // Derive a 32-byte key via HMAC-SHA256 so any string length becomes 256 bits
  return Buffer.from(
    createHmac("sha256", secret).update("dentago-aes-key-v2").digest()
  );
}

export function encrypt(text: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store as v2:<base64(iv || tag || ciphertext)>
  const combined = Buffer.concat([iv, tag, encrypted]);
  return "v2:" + combined.toString("base64");
}

export function decrypt(enc: string): string {
  // v2: AES-256-GCM
  if (enc.startsWith("v2:")) {
    return decryptV2(enc.slice(3));
  }
  // v1: or bare — legacy XOR fallback
  const bare = enc.startsWith("v1:") ? enc.slice(3) : enc;
  return decryptXOR(bare);
}

function decryptV2(b64: string): string {
  const key = getKey();
  const combined = Buffer.from(b64, "base64");
  const iv = combined.subarray(0, IV_LEN);
  const tag = combined.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = combined.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** Legacy XOR — only used to decrypt old rows during migration. Never encrypt with this. */
function decryptXOR(enc: string): string {
  const secret = process.env.CREDENTIAL_SECRET ?? "dentago-secret-key-change-in-prod";
  const encoded = Buffer.from(enc, "base64");
  const result = Buffer.alloc(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    result[i] = encoded[i] ^ secret.charCodeAt(i % secret.length);
  }
  return result.toString("utf8");
}

/** Detect if a stored value is legacy XOR (needs re-encryption on next save). */
export function isLegacyEncrypted(enc: string): boolean {
  return !enc.startsWith("v2:");
}
