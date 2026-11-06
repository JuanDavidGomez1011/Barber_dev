import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "../db";
import { SESSION_COOKIE, SESSION_DAYS, signSession, verifySessionToken, type SessionPayload } from "./jwt";

/**
 * Capa de acceso a datos de autenticación. Toda página o acción protegida
 * pasa por aquí: el proxy solo hace redirecciones rápidas, la verificación
 * real (firma + usuario activo en la base de datos) ocurre en este archivo.
 */

export async function createSession(payload: SessionPayload) {
  const token = await signSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Usuario actual (o null). Se memoiza por petición con `cache`. */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      barber: { select: { id: true, name: true, active: true } },
    },
  });
  // Si el admin desactivó al usuario, la sesión deja de valer de inmediato.
  if (!user || !user.active) return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Exige un usuario con sesión; si no hay, redirige al login. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Exige un barbero con perfil activo. Devuelve el usuario y su perfil de barbero. */
export async function requireBarber() {
  const user = await requireUser();
  if (user.role !== "BARBER" || !user.barber?.active) redirect(user.role === "ADMIN" ? "/admin" : "/login");
  return { user, barber: user.barber };
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/barbero");
  return user;
}

/** Ruta de inicio según el rol. */
export function homeFor(role: "ADMIN" | "BARBER") {
  return role === "ADMIN" ? "/admin" : "/barbero";
}
