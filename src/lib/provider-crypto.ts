/**
 * Symmetric encryption helpers for per-user provider API keys.
 *
 * Keys are encrypted with AES-256-GCM before being stored in SQLite.
 * The encryption key is derived from AVOCADOCORE_PROVIDER_KEY_SECRET
 * (server-side env var only — never exposed to the browser).
 *
 * Stored format: `<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const SALT = "avocadocore-provider-key-v1";
const KEY_LEN = 32;

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, SALT, KEY_LEN);
}

function getSecret(): string {
  const s = process.env.AVOCADOCORE_PROVIDER_KEY_SECRET;
  if (!s) {
    throw new Error(
      "AVOCADOCORE_PROVIDER_KEY_SECRET is not set. " +
        "Set it to a random 32+ character string in your .env.local (prod: system env)."
    );
  }
  return s;
}

export function encryptApiKey(plaintext: string): string {
  const key = deriveKey(getSecret());
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptApiKey(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted key format");
  }
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = deriveKey(getSecret());
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/** Returns true if provider key secret is configured (required to store keys). */
export function isKeySecretConfigured(): boolean {
  return Boolean(process.env.AVOCADOCORE_PROVIDER_KEY_SECRET);
}
