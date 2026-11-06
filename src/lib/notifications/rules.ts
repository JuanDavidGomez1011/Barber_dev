/**
 * Reglas de notificaciones. Funciones puras (probadas en tests/notifications).
 */
export type NotificationType = "CONFIRMATION" | "REMINDER_24H" | "REMINDER_2H" | "CANCELLATION" | "RESCHEDULE";

const MIN = 60_000;

/** Minutos antes de la cita en que sale cada recordatorio. */
export const REMINDER_OFFSETS = { REMINDER_24H: 24 * 60, REMINDER_2H: 2 * 60 } as const;

/** Un recordatorio que saldría casi junto con la confirmación no aporta: se omite. */
export const MIN_GAP_AFTER_NOW_MIN = 30;

/** Intentos máximos antes de marcar una notificación como fallida. */
export const MAX_ATTEMPTS = 3;

/** Una notificación tomada por un proceso que murió se libera después de este tiempo. */
export const STALE_SENDING_MIN = 10;

export const isReminder = (t: NotificationType) => t === "REMINDER_24H" || t === "REMINDER_2H";

/** Recordatorios a programar para una cita que empieza en `startsAt`. */
export function planReminders(startsAt: Date, now: Date): { type: "REMINDER_24H" | "REMINDER_2H"; scheduledFor: Date }[] {
  return (["REMINDER_24H", "REMINDER_2H"] as const)
    .map((type) => ({ type, scheduledFor: new Date(startsAt.getTime() - REMINDER_OFFSETS[type] * MIN) }))
    .filter((r) => r.scheduledFor.getTime() > now.getTime() + MIN_GAP_AFTER_NOW_MIN * MIN);
}

/** Espera antes del siguiente intento: 5 min, luego 10 min… (`attempt` = intentos ya hechos). */
export function retryDelayMinutes(attempt: number): number {
  return 5 * 2 ** Math.max(0, attempt - 1);
}

/**
 * ¿Ya no tiene sentido enviarla?
 * - Recordatorios: si la cita no sigue confirmada o falta menos de 15 min para empezar.
 * - Confirmación / reprogramación / cancelación: si se atrasó más de 24 h.
 */
export function isStale(
  n: { type: NotificationType; scheduledFor: Date },
  appt: { status: string; startsAt: Date },
  now: Date,
): string | null {
  if (isReminder(n.type)) {
    if (appt.status !== "CONFIRMED") return "La cita ya no está confirmada";
    if (now.getTime() >= appt.startsAt.getTime() - 15 * MIN) return "La cita ya va a empezar";
    return null;
  }
  if ((n.type === "CONFIRMATION" || n.type === "RESCHEDULE") && appt.status !== "CONFIRMED") {
    return "La cita ya no está confirmada";
  }
  if (now.getTime() > n.scheduledFor.getTime() + 24 * 60 * MIN) return "Se atrasó más de 24 h";
  return null;
}
