/**
 * Reglas de la agenda del barbero. Funciones puras (probadas en tests/agenda).
 */
import { addDaysISO, dayOfWeekISO, type DateISO } from "../time";

export type AppointmentStatus = "CONFIRMED" | "COMPLETED" | "NO_SHOW" | "CANCELLED";

/** Cuántos días hacia adelante se puede repetir un bloqueo. */
export const MAX_BLOCK_REPEAT_DAYS = 60;

export type TransitionCheck = { ok: true } | { ok: false; reason: string };

/**
 * ¿El barbero puede pasar la cita de `from` a `to`?
 * - Confirmada → completada / no asistió: solo cuando la cita ya empezó.
 * - Completada / no asistió → confirmada: deshacer un error.
 * - Las canceladas no se tocan.
 */
export function checkStatusTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
  startsAt: Date,
  now: Date,
): TransitionCheck {
  if (from === to) return { ok: false, reason: "La cita ya tiene ese estado." };
  if (from === "CANCELLED") return { ok: false, reason: "La cita está cancelada." };
  if (to === "CANCELLED") return { ok: false, reason: "Las cancelaciones las hace el cliente o el administrador." };

  if (from === "CONFIRMED") {
    if (now < startsAt) return { ok: false, reason: "Solo puedes marcarla cuando la cita ya haya empezado." };
    return { ok: true };
  }
  // from es COMPLETED o NO_SHOW
  if (to === "CONFIRMED" || to === "COMPLETED" || to === "NO_SHOW") return { ok: true };
  return { ok: false, reason: "Cambio de estado no permitido." };
}

/**
 * Días en que se crea un bloqueo. El primer día siempre se incluye; si se
 * repite, solo se agregan los días en que el barbero trabaja.
 */
export function expandBlockDates(first: DateISO, repeatUntil: DateISO | null, workDays: Set<number>): DateISO[] {
  if (!repeatUntil || repeatUntil <= first) return [first];
  const limit = addDaysISO(first, MAX_BLOCK_REPEAT_DAYS);
  const last = repeatUntil < limit ? repeatUntil : limit;

  const dates = [first];
  for (let d = addDaysISO(first, 1); d <= last; d = addDaysISO(d, 1)) {
    if (workDays.has(dayOfWeekISO(d))) dates.push(d);
  }
  return dates;
}
