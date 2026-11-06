import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { pickLeastBusyBarber } from "@/lib/availability/compute-slots";
import { addDaysISO, toDateISO, toMinuteOfDay, zonedToUtc } from "@/lib/time";
import { generateManageToken, hashToken } from "@/lib/tokens";
import { db } from "../db";
import { BLOCKING_STATUSES, getAvailability } from "./availability.service";

/** Máximo de citas futuras activas por número de WhatsApp (evita abusos). */
export const MAX_ACTIVE_PER_PHONE = 3;

export type BookingErrorCode =
  | "SLOT_TAKEN"
  | "SERVICE_UNAVAILABLE"
  | "LIMIT_REACHED"
  | "NOT_FOUND"
  | "NOT_MODIFIABLE"
  | "TOO_LATE";

export class BookingError extends Error {
  constructor(
    public code: BookingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

const slotTaken = () =>
  new BookingError("SLOT_TAKEN", "Ese horario se acaba de ocupar. Por favor elige otro.");

/** Error de la restricción EXCLUDE `appointment_no_overlap` (código Postgres 23P01). */
function isOverlapViolation(error: unknown): boolean {
  const text = error instanceof Error ? `${error.message} ${JSON.stringify(error)}` : String(error);
  return text.includes("appointment_no_overlap") || text.includes("23P01");
}

const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

/**
 * Ejecuta `fn` dentro de una transacción con un bloqueo exclusivo por barbero.
 * Dos reservas simultáneas para el mismo barbero esperan su turno; la segunda
 * vuelve a calcular la disponibilidad y ve la cita de la primera.
 */
async function withBarberLock<T>(barberId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${barberId}))`;
    return fn(tx);
  }, TX_OPTIONS);
}

/** ¿El horario sigue libre para ese barbero? Se calcula con datos frescos dentro de la transacción. */
async function isSlotFree(
  tx: Prisma.TransactionClient,
  args: { serviceId: string; barberId: string; startsAt: Date; timezone: string; excludeAppointmentId?: string; now: Date },
): Promise<boolean> {
  const date = toDateISO(args.startsAt, args.timezone);
  const minute = toMinuteOfDay(args.startsAt, args.timezone);
  const availability = await getAvailability(tx, {
    serviceId: args.serviceId,
    barberId: args.barberId,
    from: date,
    days: 1,
    excludeAppointmentId: args.excludeAppointmentId,
    now: args.now,
  });
  const day = availability.days.find((d) => d.date === date);
  return !!day?.slots.some((s) => s.minute === minute && s.barberIds.includes(args.barberId));
}

/**
 * Barberos a intentar, en orden. Con barbero elegido es solo ese; con
 * "cualquiera" son los libres en ese horario, el menos ocupado primero.
 */
async function candidateBarbers(args: {
  serviceId: string;
  barberId: string | null;
  startsAt: Date;
  timezone: string;
  excludeAppointmentId?: string;
  now: Date;
}): Promise<string[]> {
  if (args.barberId) return [args.barberId];

  const date = toDateISO(args.startsAt, args.timezone);
  const minute = toMinuteOfDay(args.startsAt, args.timezone);
  const availability = await getAvailability(db, {
    serviceId: args.serviceId,
    barberId: null,
    from: date,
    days: 1,
    excludeAppointmentId: args.excludeAppointmentId,
    now: args.now,
  });
  const free = availability.days.find((d) => d.date === date)?.slots.find((s) => s.minute === minute)?.barberIds ?? [];
  if (free.length === 0) return [];

  const dayStart = zonedToUtc(date, 0, args.timezone);
  const dayEnd = zonedToUtc(addDaysISO(date, 1), 0, args.timezone);
  const [barbers, counts] = await Promise.all([
    db.barber.findMany({ where: { id: { in: free } }, select: { id: true, sortOrder: true } }),
    db.appointment.groupBy({
      by: ["barberId"],
      where: { barberId: { in: free }, status: { in: [...BLOCKING_STATUSES] }, startsAt: { gte: dayStart, lt: dayEnd } },
      _count: { _all: true },
    }),
  ]);
  const countOf = new Map(counts.map((c) => [c.barberId, c._count._all]));
  const ordered: string[] = [];
  let pool = barbers.map((b) => ({ id: b.id, sortOrder: b.sortOrder, appointmentsThatDay: countOf.get(b.id) ?? 0 }));
  while (pool.length > 0) {
    const next = pickLeastBusyBarber(pool)!;
    ordered.push(next);
    pool = pool.filter((b) => b.id !== next);
  }
  return ordered;
}

/**
 * Intenta la operación con cada barbero candidato hasta que uno funcione.
 * Cada intento usa su propia transacción y bloquea un solo barbero (sin riesgo de deadlock).
 */
async function tryCandidates<T>(
  candidates: string[],
  attempt: (barberId: string, tx: Prisma.TransactionClient) => Promise<T | null>,
): Promise<T> {
  for (const barberId of candidates) {
    try {
      const result = await withBarberLock(barberId, (tx) => attempt(barberId, tx));
      if (result !== null) return result;
    } catch (error) {
      // Si otra reserva ganó la carrera, la restricción EXCLUDE lo detecta: probamos el siguiente.
      if (isOverlapViolation(error)) continue;
      throw error;
    }
  }
  throw slotTaken();
}

// ------------------------------------------------------------------ crear

export interface CreateBookingData {
  serviceId: string;
  barberId: string | null;
  startsAt: Date;
  name: string;
  phone: string;
  note: string | null;
}

export async function createBooking(data: CreateBookingData, now = new Date()) {
  const [settings, service] = await Promise.all([
    db.businessSettings.findUniqueOrThrow({ where: { id: 1 } }),
    db.service.findFirst({ where: { id: data.serviceId, active: true } }),
  ]);
  if (!service) throw new BookingError("SERVICE_UNAVAILABLE", "Este servicio ya no está disponible.");

  const activeCount = await db.appointment.count({
    where: { customer: { phone: data.phone }, status: "CONFIRMED", startsAt: { gt: now } },
  });
  if (activeCount >= MAX_ACTIVE_PER_PHONE) {
    throw new BookingError(
      "LIMIT_REACHED",
      `Ya tienes ${activeCount} citas próximas con este número. Cancela una o escríbenos por WhatsApp.`,
    );
  }

  const tz = settings.timezone;
  const candidates = await candidateBarbers({ serviceId: service.id, barberId: data.barberId, startsAt: data.startsAt, timezone: tz, now });
  const { token, hash } = generateManageToken();

  const appointment = await tryCandidates(candidates, async (barberId, tx) => {
    if (!(await isSlotFree(tx, { serviceId: service.id, barberId, startsAt: data.startsAt, timezone: tz, now }))) return null;

    const customer = await tx.customer.upsert({
      where: { phone: data.phone },
      update: { name: data.name },
      create: { name: data.name, phone: data.phone },
    });

    return tx.appointment.create({
      data: {
        barberId,
        serviceId: service.id,
        customerId: customer.id,
        startsAt: data.startsAt,
        endsAt: new Date(data.startsAt.getTime() + service.durationMin * 60_000),
        priceCop: service.priceCop,
        durationMin: service.durationMin,
        note: data.note,
        manageTokenHash: hash,
        anyBarber: data.barberId === null,
      },
    });
  });

  return { appointment, token };
}

// ------------------------------------------------------------------ consultar

export async function getAppointmentByToken(token: string) {
  return db.appointment.findUnique({
    where: { manageTokenHash: hashToken(token) },
    include: {
      service: { select: { id: true, name: true } },
      barber: { select: { id: true, name: true } },
      customer: { select: { name: true, phone: true } },
    },
  });
}

/** Si la cita se puede cancelar o reprogramar ahora, y hasta cuándo. */
export function modificationWindow(
  appointment: { status: string; startsAt: Date },
  cancelLimitMinutes: number,
  now = new Date(),
) {
  const deadline = new Date(appointment.startsAt.getTime() - cancelLimitMinutes * 60_000);
  return { canModify: appointment.status === "CONFIRMED" && now < deadline, deadline };
}

async function loadModifiable(token: string, now: Date) {
  const [settings, appointment] = await Promise.all([
    db.businessSettings.findUniqueOrThrow({ where: { id: 1 } }),
    db.appointment.findUnique({ where: { manageTokenHash: hashToken(token) } }),
  ]);
  if (!appointment) throw new BookingError("NOT_FOUND", "No encontramos esta cita.");
  if (appointment.status !== "CONFIRMED") {
    throw new BookingError("NOT_MODIFIABLE", "Esta cita ya no se puede modificar.");
  }
  if (!modificationWindow(appointment, settings.cancelLimitMinutes, now).canModify) {
    const hours = Math.round(settings.cancelLimitMinutes / 60);
    throw new BookingError(
      "TOO_LATE",
      `Las citas solo se pueden cancelar o reprogramar hasta ${hours} horas antes. Escríbenos por WhatsApp.`,
    );
  }
  return { settings, appointment };
}

// ------------------------------------------------------------------ cancelar

export async function cancelBooking(token: string, now = new Date()) {
  const { appointment } = await loadModifiable(token, now);
  // `updateMany` con condición de estado: si dos clics llegan a la vez, solo uno cancela.
  const { count } = await db.appointment.updateMany({
    where: { id: appointment.id, status: "CONFIRMED" },
    data: { status: "CANCELLED", cancelledAt: now, cancelReason: "Cancelada por el cliente" },
  });
  if (count === 0) throw new BookingError("NOT_MODIFIABLE", "Esta cita ya no se puede modificar.");
  return appointment.id;
}

// ------------------------------------------------------------------ reprogramar

export async function rescheduleBooking(
  token: string,
  data: { barberId: string | null; startsAt: Date },
  now = new Date(),
) {
  const { settings, appointment } = await loadModifiable(token, now);
  const tz = settings.timezone;
  const service = await db.service.findUnique({ where: { id: appointment.serviceId } });
  if (!service?.active) throw new BookingError("SERVICE_UNAVAILABLE", "Este servicio ya no está disponible.");

  const candidates = await candidateBarbers({
    serviceId: service.id,
    barberId: data.barberId,
    startsAt: data.startsAt,
    timezone: tz,
    excludeAppointmentId: appointment.id,
    now,
  });

  return tryCandidates(candidates, async (barberId, tx) => {
    const free = await isSlotFree(tx, {
      serviceId: service.id,
      barberId,
      startsAt: data.startsAt,
      timezone: tz,
      excludeAppointmentId: appointment.id,
      now,
    });
    if (!free) return null;

    const { count } = await tx.appointment.updateMany({
      where: { id: appointment.id, status: "CONFIRMED" },
      data: {
        barberId,
        startsAt: data.startsAt,
        // La disponibilidad se validó con la duración actual del servicio.
        endsAt: new Date(data.startsAt.getTime() + service.durationMin * 60_000),
        durationMin: service.durationMin,
        anyBarber: data.barberId === null,
        rescheduleCount: { increment: 1 },
      },
    });
    if (count === 0) throw new BookingError("NOT_MODIFIABLE", "Esta cita ya no se puede modificar.");
    return appointment.id;
  });
}
