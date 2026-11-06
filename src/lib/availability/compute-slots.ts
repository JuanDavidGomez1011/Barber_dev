/**
 * Cálculo de horarios disponibles. Funciones puras: no tocan la base de
 * datos ni el reloj, todo llega por parámetro. Así se pueden probar con
 * casos exactos (ver tests/availability).
 */
import { zonedToUtc, type DateISO } from "../time";

/** Intervalo semiabierto [start, end) en milisegundos epoch. */
export interface BusyInterval {
  start: number;
  end: number;
}

/** Turno del barbero en minutos desde medianoche (hora del negocio). */
export interface Shift {
  startMinute: number;
  endMinute: number;
}

export interface DayRules {
  /** El local está cerrado ese día (día de la semana cerrado o festivo). */
  closed: boolean;
  /** Horario de atención del local ese día; limita los turnos del barbero. */
  openMinute: number;
  closeMinute: number;
}

export interface BarberDayInput {
  date: DateISO;
  timezone: string;
  durationMin: number;
  intervalMin: number;
  day: DayRules;
  shifts: Shift[];
  /** Citas activas y bloqueos del barbero que tocan ese día. */
  busy: BusyInterval[];
  /** Ningún horario puede empezar antes de este instante (ahora + anticipación mínima). */
  earliestStart: number;
}

const MINUTE = 60_000;

export function overlaps(a: BusyInterval, b: BusyInterval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Horarios de inicio disponibles para un barbero en un día.
 * Devuelve minutos desde medianoche, ordenados y sin repetir.
 *
 * Reglas:
 * - Los inicios están alineados a la grilla del reloj (múltiplos de `intervalMin`
 *   desde medianoche): con 15 min → 09:00, 09:15, 09:30…
 * - El servicio completo debe caber dentro de un turno y dentro del horario del local.
 * - No puede cruzarse con citas ni bloqueos (`busy`).
 * - No puede empezar antes de `earliestStart`.
 */
export function computeBarberSlots(input: BarberDayInput): number[] {
  const { date, timezone, durationMin, intervalMin, day, shifts, busy, earliestStart } = input;
  if (day.closed || durationMin <= 0 || intervalMin <= 0) return [];

  const result = new Set<number>();

  for (const shift of shifts) {
    const from = Math.max(shift.startMinute, day.openMinute);
    const to = Math.min(shift.endMinute, day.closeMinute);
    const firstStart = Math.ceil(from / intervalMin) * intervalMin;

    for (let minute = firstStart; minute + durationMin <= to; minute += intervalMin) {
      const start = zonedToUtc(date, minute, timezone).getTime();
      if (start < earliestStart) continue;
      const candidate = { start, end: start + durationMin * MINUTE };
      if (busy.some((b) => overlaps(candidate, b))) continue;
      result.add(minute);
    }
  }

  return [...result].sort((a, b) => a - b);
}

/**
 * Horarios para "cualquiera disponible": la unión de los horarios de varios
 * barberos, con la lista de barberos libres en cada horario.
 */
export function mergeBarberSlots(perBarber: Map<string, number[]>): Map<number, string[]> {
  const merged = new Map<number, string[]>();
  for (const [barberId, slots] of perBarber) {
    for (const minute of slots) {
      const list = merged.get(minute);
      if (list) list.push(barberId);
      else merged.set(minute, [barberId]);
    }
  }
  return new Map([...merged.entries()].sort(([a], [b]) => a - b));
}

/**
 * Elige el barbero para una reserva con "cualquiera disponible":
 * el que tenga menos citas ese día; en empate, el de menor `sortOrder`.
 */
export function pickLeastBusyBarber(
  candidates: { id: string; sortOrder: number; appointmentsThatDay: number }[],
): string | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort(
    (a, b) => a.appointmentsThatDay - b.appointmentsThatDay || a.sortOrder - b.sortOrder,
  )[0].id;
}
