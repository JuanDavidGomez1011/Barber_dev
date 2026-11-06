/**
 * Reglas del límite de intentos de inicio de sesión (funciones puras).
 *
 * Se cuentan solo los intentos FALLIDOS dentro de una ventana deslizante:
 * - por correo: frena a quien prueba contraseñas contra una cuenta;
 * - por IP: frena a quien prueba muchos correos desde el mismo equipo
 *   (más alto, porque una barbería puede compartir una sola IP de wifi).
 */
export const LOGIN_LIMIT = {
  windowMinutes: 15,
  maxPerEmail: 5,
  maxPerIp: 20,
  /** Las filas más viejas que esto ya no cuentan y el cron las borra. */
  retentionHours: 24,
} as const;

export const emailKey = (email: string) => `email:${email.trim().toLowerCase()}`;
export const ipKey = (ip: string) => `ip:${ip}`;

export function windowStart(now: Date, windowMinutes: number = LOGIN_LIMIT.windowMinutes) {
  return new Date(now.getTime() - windowMinutes * 60_000);
}

export function isLoginBlocked(failures: { email: number; ip: number }, limit = LOGIN_LIMIT) {
  return failures.email >= limit.maxPerEmail || failures.ip >= limit.maxPerIp;
}

/**
 * Minutos que faltan para que el intento fallido más viejo salga de la ventana
 * (y con eso se libere un intento). Mínimo 1.
 */
export function minutesUntilRetry(oldestFailure: Date | null, now: Date, windowMinutes: number = LOGIN_LIMIT.windowMinutes) {
  if (!oldestFailure) return windowMinutes;
  const ms = oldestFailure.getTime() + windowMinutes * 60_000 - now.getTime();
  return Math.max(1, Math.ceil(ms / 60_000));
}

/**
 * IP del cliente a partir de los encabezados del proxy (Vercel pone la IP real
 * en `x-forwarded-for`; el primer valor es el cliente). null si no hay.
 */
export function clientIpFrom(headers: { get(name: string): string | null }): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip")?.trim();
  if (!ip || ip.length > 64) return null;
  return ip;
}
