import "server-only";
import {
  emailKey,
  ipKey,
  isLoginBlocked,
  LOGIN_LIMIT,
  minutesUntilRetry,
  windowStart,
} from "@/lib/auth/login-limit";
import { db } from "../db";

/**
 * Límite de intentos guardado en la base de datos: en Vercel cada petición
 * puede caer en una instancia distinta, así que la memoria no sirve.
 */

function keysFor(email: string, ip: string | null) {
  return { email: emailKey(email), ip: ip ? ipKey(ip) : null };
}

/** Si está bloqueado, devuelve cuántos minutos esperar; si no, null. */
export async function checkLoginLimit(email: string, ip: string | null, now = new Date()): Promise<number | null> {
  const keys = keysFor(email, ip);
  const since = windowStart(now);
  const [emailFailures, ipFailures] = await Promise.all([
    db.loginAttempt.findMany({
      where: { key: keys.email, createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    keys.ip ? db.loginAttempt.count({ where: { key: keys.ip, createdAt: { gte: since } } }) : Promise.resolve(0),
  ]);

  if (!isLoginBlocked({ email: emailFailures.length, ip: ipFailures })) return null;

  // Bloqueado por correo: se libera cuando el fallo más viejo sale de la ventana.
  // Bloqueado solo por IP: se devuelve la ventana completa (aproximado, sin otra consulta).
  const byEmail = emailFailures.length >= LOGIN_LIMIT.maxPerEmail;
  return minutesUntilRetry(byEmail ? emailFailures[0].createdAt : null, now);
}

export async function recordLoginFailure(email: string, ip: string | null, now = new Date()) {
  const keys = keysFor(email, ip);
  await db.loginAttempt.createMany({
    data: [keys.email, keys.ip].filter((k): k is string => k !== null).map((key) => ({ key, createdAt: now })),
  });
}

/** Tras entrar bien, los fallos previos de ese correo dejan de contar (los de la IP siguen). */
export async function clearLoginFailures(email: string) {
  await db.loginAttempt.deleteMany({ where: { key: emailKey(email) } });
}

/** Borra los intentos viejos. Lo llama el cron. */
export async function pruneLoginAttempts(now = new Date()) {
  const { count } = await db.loginAttempt.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - LOGIN_LIMIT.retentionHours * 3_600_000) } },
  });
  return count;
}
