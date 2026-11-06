import "server-only";
import type { DbClient, DbTx } from "../db";
import {
  computeBarberSlots,
  mergeBarberSlots,
  type BusyInterval,
} from "@/lib/availability/compute-slots";
import {
  addDaysISO,
  dateISOToDbDate,
  dayOfWeekISO,
  dbDateToDateISO,
  formatMinute,
  toDateISO,
  zonedToUtc,
  type DateISO,
} from "@/lib/time";

/** Funciona con el cliente normal o dentro de una transacción. */
type Db = DbClient | DbTx;

/** Estados que ocupan el horario del barbero (igual que la restricción EXCLUDE). */
export const BLOCKING_STATUSES = ["CONFIRMED", "COMPLETED"] as const;

export interface AvailabilityParams {
  serviceId: string;
  /** null = cualquier barbero que preste el servicio. */
  barberId: string | null;
  /** Primer día a consultar (por defecto, hoy). */
  from?: DateISO;
  /** Cuántos días (se recorta al horizonte de reserva). */
  days?: number;
  /** Al reprogramar, esta cita no cuenta como ocupada. */
  excludeAppointmentId?: string;
  now?: Date;
}

export interface Slot {
  minute: number;
  time: string;
  startsAt: string;
  barberIds: string[];
}

export interface AvailabilityDay {
  date: DateISO;
  slots: Slot[];
}

export interface AvailabilityResult {
  timezone: string;
  durationMin: number;
  days: AvailabilityDay[];
}

export class AvailabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AvailabilityError";
  }
}

export async function getAvailability(client: Db, params: AvailabilityParams): Promise<AvailabilityResult> {
  const now = params.now ?? new Date();

  const [settings, service] = await Promise.all([
    client.businessSettings.findUniqueOrThrow({ where: { id: 1 } }),
    client.service.findFirst({ where: { id: params.serviceId, active: true } }),
  ]);
  if (!service) throw new AvailabilityError("El servicio no existe o no está disponible.");

  const tz = settings.timezone;
  const today = toDateISO(now, tz);
  const lastDay = addDaysISO(today, settings.bookingHorizonDays - 1);
  const from = params.from && params.from > today ? params.from : today;
  const requestedLast = addDaysISO(from, (params.days ?? settings.bookingHorizonDays) - 1);
  const to = requestedLast < lastDay ? requestedLast : lastDay;
  if (from > to) return { timezone: tz, durationMin: service.durationMin, days: [] };

  const rangeStart = zonedToUtc(from, 0, tz);
  const rangeEnd = zonedToUtc(addDaysISO(to, 1), 0, tz);

  const barbers = await client.barber.findMany({
    where: {
      active: true,
      services: { some: { serviceId: service.id } },
      ...(params.barberId ? { id: params.barberId } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { workingHours: true },
  });
  if (barbers.length === 0) {
    if (params.barberId) throw new AvailabilityError("Ese barbero no presta este servicio.");
    return { timezone: tz, durationMin: service.durationMin, days: [] };
  }
  const barberIds = barbers.map((b) => b.id);

  const [businessHours, closedDays, appointments, blocks] = await Promise.all([
    client.businessHours.findMany(),
    client.closedDay.findMany({
      where: { date: { gte: dateISOToDbDate(from), lte: dateISOToDbDate(to) } },
    }),
    client.appointment.findMany({
      where: {
        barberId: { in: barberIds },
        status: { in: [...BLOCKING_STATUSES] },
        startsAt: { lt: rangeEnd },
        endsAt: { gt: rangeStart },
        ...(params.excludeAppointmentId ? { id: { not: params.excludeAppointmentId } } : {}),
      },
      select: { barberId: true, startsAt: true, endsAt: true },
    }),
    client.timeBlock.findMany({
      where: { barberId: { in: barberIds }, startsAt: { lt: rangeEnd }, endsAt: { gt: rangeStart } },
      select: { barberId: true, startsAt: true, endsAt: true },
    }),
  ]);

  const hoursByDay = new Map(businessHours.map((bh) => [bh.dayOfWeek, bh]));
  const closedSet = new Set(closedDays.map((c) => dbDateToDateISO(c.date)));
  const busyByBarber = new Map<string, BusyInterval[]>(barberIds.map((id) => [id, []]));
  for (const item of [...appointments, ...blocks]) {
    busyByBarber.get(item.barberId)!.push({ start: item.startsAt.getTime(), end: item.endsAt.getTime() });
  }
  const earliestStart = now.getTime() + settings.minLeadMinutes * 60_000;

  const days: AvailabilityDay[] = [];
  for (let date = from; date <= to; date = addDaysISO(date, 1)) {
    const dow = dayOfWeekISO(date);
    const hours = hoursByDay.get(dow);
    const day = {
      closed: !hours || hours.isClosed || closedSet.has(date),
      openMinute: hours?.openMinute ?? 0,
      closeMinute: hours?.closeMinute ?? 0,
    };

    const perBarber = new Map<string, number[]>();
    for (const barber of barbers) {
      perBarber.set(
        barber.id,
        computeBarberSlots({
          date,
          timezone: tz,
          durationMin: service.durationMin,
          intervalMin: settings.slotIntervalMinutes,
          day,
          shifts: barber.workingHours.filter((w) => w.dayOfWeek === dow),
          busy: busyByBarber.get(barber.id)!,
          earliestStart,
        }),
      );
    }

    const slots = [...mergeBarberSlots(perBarber)].map(([minute, ids]) => ({
      minute,
      time: formatMinute(minute),
      startsAt: zonedToUtc(date, minute, tz).toISOString(),
      barberIds: ids,
    }));
    days.push({ date, slots });
  }

  return { timezone: tz, durationMin: service.durationMin, days };
}
