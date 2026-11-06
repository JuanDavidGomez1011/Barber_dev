import "server-only";
import { checkStatusTransition, expandBlockDates, type AppointmentStatus } from "@/lib/agenda/rules";
import { addDaysISO, dateISOToDbDate, dayOfWeekISO, dbDateToDateISO, toDateISO, zonedToUtc, type DateISO } from "@/lib/time";
import { db } from "../db";
import { BLOCKING_STATUSES } from "./availability.service";

export class AgendaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgendaError";
  }
}

async function timezone() {
  const s = await db.businessSettings.findUniqueOrThrow({ where: { id: 1 }, select: { timezone: true } });
  return s.timezone;
}

const appointmentSelect = {
  id: true,
  startsAt: true,
  endsAt: true,
  status: true,
  priceCop: true,
  durationMin: true,
  note: true,
  anyBarber: true,
  service: { select: { name: true } },
  customer: { select: { name: true, phone: true } },
} as const;

/** Agenda de un rango de días [from, from + days) para un barbero. */
async function loadRange(barberId: string, from: DateISO, days: number) {
  const tz = await timezone();
  const rangeStart = zonedToUtc(from, 0, tz);
  const rangeEnd = zonedToUtc(addDaysISO(from, days), 0, tz);
  const lastDay = addDaysISO(from, days - 1);

  const [appointments, blocks, workingHours, closedDays] = await Promise.all([
    db.appointment.findMany({
      where: { barberId, startsAt: { gte: rangeStart, lt: rangeEnd } },
      orderBy: { startsAt: "asc" },
      select: appointmentSelect,
    }),
    db.timeBlock.findMany({
      where: { barberId, startsAt: { lt: rangeEnd }, endsAt: { gt: rangeStart } },
      orderBy: { startsAt: "asc" },
      select: { id: true, startsAt: true, endsAt: true, reason: true },
    }),
    db.workingHours.findMany({ where: { barberId }, orderBy: { startMinute: "asc" } }),
    db.closedDay.findMany({ where: { date: { gte: dateISOToDbDate(from), lte: dateISOToDbDate(lastDay) } } }),
  ]);

  const closed = new Map(closedDays.map((c) => [dbDateToDateISO(c.date), c.reason]));
  const result = [];
  for (let date = from; date <= lastDay; date = addDaysISO(date, 1)) {
    const dow = dayOfWeekISO(date);
    result.push({
      date,
      closedReason: closed.has(date) ? (closed.get(date) ?? "Cerrado") : null,
      shifts: workingHours.filter((w) => w.dayOfWeek === dow).map((w) => ({ startMinute: w.startMinute, endMinute: w.endMinute })),
      appointments: appointments.filter((a) => toDateISO(a.startsAt, tz) === date),
      blocks: blocks.filter((b) => toDateISO(b.startsAt, tz) <= date && toDateISO(new Date(b.endsAt.getTime() - 1), tz) >= date),
    });
  }
  return { timezone: tz, days: result };
}

export type AgendaDay = Awaited<ReturnType<typeof loadRange>>["days"][number];

export async function getBarberDay(barberId: string, date: DateISO) {
  const { days } = await loadRange(barberId, date, 1);
  return days[0];
}

export async function getBarberWeek(barberId: string, weekStart: DateISO) {
  return (await loadRange(barberId, weekStart, 7)).days;
}

// ------------------------------------------------------------------ estados

export async function setAppointmentStatus(
  actor: { role: "ADMIN" | "BARBER"; barberId: string | null },
  appointmentId: string,
  to: AppointmentStatus,
  now = new Date(),
) {
  const appt = await db.appointment.findUnique({ where: { id: appointmentId } });
  // Un barbero solo puede tocar sus citas; responder "no encontrada" no revela citas ajenas.
  if (!appt || (actor.role === "BARBER" && appt.barberId !== actor.barberId)) {
    throw new AgendaError("No encontramos esta cita.");
  }
  const check = checkStatusTransition(appt.status, to, appt.startsAt, now);
  if (!check.ok) throw new AgendaError(check.reason);

  try {
    // La condición sobre el estado anterior evita pisar un cambio simultáneo.
    const { count } = await db.appointment.updateMany({
      where: { id: appt.id, status: appt.status },
      data: { status: to },
    });
    if (count === 0) throw new AgendaError("La cita cambió mientras tanto. Recarga la página.");
  } catch (error) {
    // Volver a "confirmada" una inasistencia puede chocar con otra cita en ese horario.
    if (String(error).includes("appointment_no_overlap")) {
      throw new AgendaError("No se puede: ese horario ya lo ocupa otra cita.");
    }
    throw error;
  }
}

// ------------------------------------------------------------------ bloqueos

export interface NewBlock {
  date: DateISO;
  startMinute: number;
  endMinute: number;
  reason: string | null;
  repeatUntil: DateISO | null;
}

export type BlockConflict = { date: DateISO; startsAt: Date; customer: string; service: string };

/**
 * Crea uno o varios bloqueos (si se repite). Si alguno se cruza con una cita
 * confirmada no crea ninguno y devuelve los cruces, para que el barbero decida.
 */
export async function createTimeBlocks(barberId: string, block: NewBlock, now = new Date()) {
  if (block.endMinute <= block.startMinute) throw new AgendaError("La hora final debe ser posterior a la inicial.");
  const tz = await timezone();

  const workDays = new Set(
    (await db.workingHours.findMany({ where: { barberId }, select: { dayOfWeek: true } })).map((w) => w.dayOfWeek),
  );
  const intervals = expandBlockDates(block.date, block.repeatUntil, workDays).map((date) => ({
    date,
    startsAt: zonedToUtc(date, block.startMinute, tz),
    endsAt: zonedToUtc(date, block.endMinute, tz),
  }));
  const future = intervals.filter((i) => i.endsAt > now);
  if (future.length === 0) throw new AgendaError("Ese horario ya pasó.");

  const conflicts = await db.appointment.findMany({
    where: {
      barberId,
      status: { in: [...BLOCKING_STATUSES] },
      OR: future.map((i) => ({ startsAt: { lt: i.endsAt }, endsAt: { gt: i.startsAt } })),
    },
    orderBy: { startsAt: "asc" },
    select: { startsAt: true, customer: { select: { name: true } }, service: { select: { name: true } } },
  });
  if (conflicts.length > 0) {
    return {
      created: 0,
      conflicts: conflicts.map<BlockConflict>((c) => ({
        date: toDateISO(c.startsAt, tz),
        startsAt: c.startsAt,
        customer: c.customer.name,
        service: c.service.name,
      })),
    };
  }

  const { count } = await db.timeBlock.createMany({
    data: future.map((i) => ({ barberId, startsAt: i.startsAt, endsAt: i.endsAt, reason: block.reason })),
  });
  return { created: count, conflicts: [] as BlockConflict[] };
}

export async function listUpcomingBlocks(barberId: string, now = new Date()) {
  return db.timeBlock.findMany({
    where: { barberId, endsAt: { gt: now } },
    orderBy: { startsAt: "asc" },
    take: 100,
    select: { id: true, startsAt: true, endsAt: true, reason: true },
  });
}

export async function deleteTimeBlock(barberId: string, blockId: string) {
  const { count } = await db.timeBlock.deleteMany({ where: { id: blockId, barberId } });
  if (count === 0) throw new AgendaError("No encontramos ese bloqueo.");
}
