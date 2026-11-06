import { createHash, randomBytes } from "node:crypto";

/** Hash que se guarda en la base de datos; el token en claro solo viaja en el enlace. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Genera el token del enlace único para cancelar o reprogramar una cita. */
export function generateManageToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}
