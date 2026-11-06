import { TZDate } from "@date-fns/tz";

/** Zona horaria del negocio. Colombia no tiene horario de verano (UTC-5 todo el año). */
export const BUSINESS_TZ = "America/Bogota";

/** Fecha de calendario en la zona del negocio, formato `YYYY-MM-DD`. */
export type DateISO = string;

const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateISO(date: DateISO): [number, number, number] {
  if (!DATE_ISO_RE.test(date)) throw new Error(`Fecha inválida: ${date}`);
  const [y, m, d] = date.split("-").map(Number);
  return [y, m, d];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Convierte una fecha local + minuto del día (en `tz`) al instante UTC correspondiente. */
export function zonedToUtc(date: DateISO, minuteOfDay: number, tz: string = BUSINESS_TZ): Date {
  const [y, m, d] = parseDateISO(date);
  const local = new TZDate(y, m - 1, d, Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, tz);
  return new Date(local.getTime());
}

/** Fecha de calendario (`YYYY-MM-DD`) de un instante, vista en `tz`. */
export function toDateISO(instant: Date, tz: string = BUSINESS_TZ): DateISO {
  const z = new TZDate(instant.getTime(), tz);
  return `${z.getFullYear()}-${pad(z.getMonth() + 1)}-${pad(z.getDate())}`;
}

/** Minuto del día (0–1439) de un instante, visto en `tz`. */
export function toMinuteOfDay(instant: Date, tz: string = BUSINESS_TZ): number {
  const z = new TZDate(instant.getTime(), tz);
  return z.getHours() * 60 + z.getMinutes();
}

/** Suma días a una fecha de calendario (sin depender de zonas horarias). */
export function addDaysISO(date: DateISO, days: number): DateISO {
  const [y, m, d] = parseDateISO(date);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Día de la semana de una fecha de calendario: 0 = domingo … 6 = sábado. */
export function dayOfWeekISO(date: DateISO): number {
  const [y, m, d] = parseDateISO(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Fecha de calendario como `Date` a medianoche UTC, para columnas `@db.Date`. */
export function dateISOToDbDate(date: DateISO): Date {
  const [y, m, d] = parseDateISO(date);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Inverso de `dateISOToDbDate`. */
export function dbDateToDateISO(date: Date): DateISO {
  return date.toISOString().slice(0, 10);
}

/** "HH:mm" a partir de minutos desde medianoche. */
export function formatMinute(minuteOfDay: number): string {
  return `${pad(Math.floor(minuteOfDay / 60))}:${pad(minuteOfDay % 60)}`;
}

/** Lunes de la semana de una fecha (semanas de lunes a domingo). */
export function startOfWeekISO(date: DateISO): DateISO {
  const dow = dayOfWeekISO(date); // 0 = domingo
  return addDaysISO(date, dow === 0 ? -6 : 1 - dow);
}

/** "HH:mm" → minutos desde medianoche. null si el formato no es válido. */
export function parseTimeHHmm(value: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
