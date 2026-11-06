import { BUSINESS_TZ } from "./time";

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** $ 25.000 */
export function formatCop(amount: number): string {
  return cop.format(amount);
}

/** "30 min", "1 h", "1 h 15 min" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Martes 10 de noviembre" */
export function formatLongDate(instant: Date | string, tz: string = BUSINESS_TZ): string {
  const s = new Intl.DateTimeFormat("es-CO", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(instant));
  return capitalize(s);
}

/** "9:30 a. m." */
export function formatTime(instant: Date | string, tz: string = BUSINESS_TZ): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(instant));
}

/** Para fechas de calendario `YYYY-MM-DD`: { weekday: "mar", day: "10", month: "nov" } */
export function formatDayChip(dateISO: string) {
  const d = new Date(`${dateISO}T12:00:00Z`);
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", ...opts }).format(d).replace(".", "");
  return {
    weekday: capitalize(fmt({ weekday: "short" })),
    day: fmt({ day: "numeric" }),
    month: fmt({ month: "short" }),
  };
}

/** "+57 300 123 4567" */
export function formatPhone(e164: string): string {
  const m = e164.match(/^\+57(\d{3})(\d{3})(\d{4})$/);
  return m ? `+57 ${m[1]} ${m[2]} ${m[3]}` : e164;
}
