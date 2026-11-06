import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Cifrado simétrico (AES-256-GCM) para guardar el token del enlace de gestión
 * y poder reenviarlo en los recordatorios. La clave sale de TOKEN_SECRET (o,
 * si no existe, de SESSION_SECRET); sin ella, lo guardado en la base no sirve.
 */
function key(): Buffer {
  const secret = process.env.TOKEN_SECRET ?? process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("Falta TOKEN_SECRET o SESSION_SECRET (mínimo 32 caracteres).");
  return createHash("sha256").update(`manage-token:${secret}`).digest();
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

/** Devuelve null si el texto fue alterado o se cifró con otra clave. */
export function decryptToken(encoded: string): string | null {
  try {
    const [iv, tag, data] = encoded.split(".").map((p) => Buffer.from(p, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
