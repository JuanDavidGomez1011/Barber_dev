import { jwtVerify, SignJWT } from "jose";

/** Lo mínimo para identificar al usuario; nada sensible (el JWT se puede leer, solo está firmado). */
export interface SessionPayload {
  userId: string;
  role: "ADMIN" | "BARBER";
}

export const SESSION_COOKIE = "barberia_session";
export const SESSION_DAYS = 7;

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET no está definido o tiene menos de 32 caracteres (ver .env.example).");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key());
}

/** Devuelve el contenido si la firma y la expiración son válidas; si no, null. */
export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.userId !== "string" || (payload.role !== "ADMIN" && payload.role !== "BARBER")) return null;
    return { userId: payload.userId, role: payload.role };
  } catch {
    return null;
  }
}
