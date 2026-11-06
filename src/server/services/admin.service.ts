import "server-only";
import bcrypt from "bcryptjs";
import type { Prisma } from "@/generated/prisma/client";
import { computeDashboard } from "@/lib/dashboard/stats";
import { addDaysISO, dateISOToDbDate, dbDateToDateISO, startOfWeekISO, toDateISO, zonedToUtc, type DateISO } from "@/lib/time";
import type { AppointmentFilters } from "@/lib/validation/admin";
import { db } from "../db";

export class AdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminError";
  }
}

async function settings() {
  return db.businessSettings.findUniqueOrThrow({ where: { id: 1 } });
}

/** Traduce errores de unicidad de Prisma a mensajes claros. */
function rethrowUnique(error: unknown, message: string): never {
  if (typeof error === "object" && error && "code" in error && error.code === "P2002") throw new AdminError(message);
  throw error;
}

// ------------------------------------------------------------------ servicios

type ServiceData = { name: string; description: string | null; durationMin: number; priceCop: number; sortOrder: number; active: boolean };

export async function listServices() {
  return db.service.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { appointments: true, barbers: true } } },
  });
}

export async function createService(data: ServiceData) {
  return db.service.create({ data });
}

export async function updateService(id: string, data: ServiceData) {
  // Las citas ya agendadas guardan su propio precio y duración: no cambian.
  return db.service.update({ where: { id }, data });
}

export async function deleteService(id: string) {
  const count = await db.appointment.count({ where: { serviceId: id } });
  if (count > 0) {
    throw new AdminError(`Este servicio tiene ${count} citas en el historial. Desactívalo en vez de borrarlo.`);
  }
  await db.service.delete({ where: { id } });
}

// ------------------------------------------------------------------ barberos

export async function listBarbers() {
  return db.barber.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      user: { select: { email: true } },
      services: { select: { service: { select: { name: true } } } },
      workingHours: { orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }] },
    },
  });
}

export async function getBarber(id: string) {
  return db.barber.findUnique({
    where: { id },
    include: {
      user: { select: { email: true } },
      services: { select: { serviceId: true } },
      workingHours: { orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }] },
    },
  });
}

function slugify(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "barbero"
  );
}

async function uniqueSlug(name: string, excludeId?: string) {
  const base = slugify(name);
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const taken = await db.barber.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) } });
    if (!taken) return slug;
  }
  return `${base}-${Date.now()}`;
}

type BarberData = {
  name: string;
  bio: string | null;
  photoUrl: string | null;
  email: string;
  sortOrder: number;
  active: boolean;
  serviceIds: string[];
};

export async function createBarber(data: BarberData & { password: string }) {
  const passwordHash = await bcrypt.hash(data.password, 10);
  try {
    return await db.barber.create({
      data: {
        name: data.name,
        bio: data.bio,
        photoUrl: data.photoUrl,
        sortOrder: data.sortOrder,
        active: data.active,
        slug: await uniqueSlug(data.name),
        user: { create: { email: data.email, name: data.name, role: "BARBER", passwordHash, active: data.active } },
        services: { create: data.serviceIds.map((serviceId) => ({ serviceId })) },
      },
    });
  } catch (error) {
    rethrowUnique(error, "Ya existe un usuario con ese correo.");
  }
}

export async function updateBarber(id: string, data: BarberData) {
  const barber = await db.barber.findUnique({ where: { id } });
  if (!barber) throw new AdminError("Barbero no encontrado.");
  try {
    await db.$transaction(async (tx) => {
      await tx.barber.update({
        where: { id },
        data: {
          name: data.name,
          bio: data.bio,
          photoUrl: data.photoUrl,
          sortOrder: data.sortOrder,
          active: data.active,
          ...(barber.name !== data.name ? { slug: await uniqueSlug(data.name, id) } : {}),
        },
      });
      // Usuario de acceso: se actualiza o se crea si el barbero no tenía.
      if (barber.userId) {
        await tx.user.update({ where: { id: barber.userId }, data: { email: data.email, name: data.name, active: data.active } });
      }
      await tx.barberService.deleteMany({ where: { barberId: id } });
      if (data.serviceIds.length > 0) {
        await tx.barberService.createMany({ data: data.serviceIds.map((serviceId) => ({ barberId: id, serviceId })) });
      }
    });
  } catch (error) {
    rethrowUnique(error, "Ya existe un usuario con ese correo.");
  }
}

export async function setBarberPassword(id: string, password: string) {
  const barber = await db.barber.findUnique({ where: { id }, include: { user: true } });
  if (!barber) throw new AdminError("Barbero no encontrado.");
  const passwordHash = await bcrypt.hash(password, 10);
  if (barber.user) {
    await db.user.update({ where: { id: barber.user.id }, data: { passwordHash } });
  } else {
    throw new AdminError("Este barbero no tiene usuario de acceso. Guarda primero sus datos con un correo.");
  }
}

export async function setWorkingHours(barberId: string, shifts: { dayOfWeek: number; start: number; end: number }[]) {
  await db.$transaction([
    db.workingHours.deleteMany({ where: { barberId } }),
    db.workingHours.createMany({
      data: shifts.map((s) => ({ barberId, dayOfWeek: s.dayOfWeek, startMinute: s.start, endMinute: s.end })),
    }),
  ]);
}

/** Citas confirmadas futuras del barbero (para avisar antes de desactivarlo). */
export async function futureConfirmedCount(barberId: string, now = new Date()) {
  return db.appointment.count({ where: { barberId, status: "CONFIRMED", startsAt: { gt: now } } });
}

// ------------------------------------------------------------------ local

export async function getBusinessHours() {
  return db.businessHours.findMany({ orderBy: { dayOfWeek: "asc" } });
}

export async function setBusinessHours(days: { dayOfWeek: number; isClosed: boolean; open: number; close: number }[]) {
  await db.$transaction(
    days.map((d) =>
      db.businessHours.upsert({
        where: { dayOfWeek: d.dayOfWeek },
        update: { isClosed: d.isClosed, openMinute: d.open, closeMinute: d.close },
        create: { dayOfWeek: d.dayOfWeek, isClosed: d.isClosed, openMinute: d.open, closeMinute: d.close },
      }),
    ),
  );
}

export async function listClosedDays(now = new Date()) {
  const s = await settings();
  const today = toDateISO(now, s.timezone);
  const days = await db.closedDay.findMany({ where: { date: { gte: dateISOToDbDate(today) } }, orderBy: { date: "asc" } });
  return days.map((d) => ({ id: d.id, date: dbDateToDateISO(d.date), reason: d.reason }));
}

export async function createClosedDay(data: { date: DateISO; reason: string | null; force: boolean }) {
  const s = await settings();
  const start = zonedToUtc(data.date, 0, s.timezone);
  const end = zonedToUtc(addDaysISO(data.date, 1), 0, s.timezone);
  const conflicts = await db.appointment.count({ where: { status: "CONFIRMED", startsAt: { gte: start, lt: end } } });
  if (conflicts > 0 && !data.force) return { created: false, conflicts };
  try {
    await db.closedDay.create({ data: { date: dateISOToDbDate(data.date), reason: data.reason } });
  } catch (error) {
    rethrowUnique(error, "Ese día ya está marcado como cerrado.");
  }
  return { created: true, conflicts };
}

export async function deleteClosedDay(id: string) {
  await db.closedDay.deleteMany({ where: { id } });
}

export async function getSettings() {
  return settings();
}

export async function updateSettings(data: Prisma.BusinessSettingsUpdateInput) {
  await db.businessSettings.update({ where: { id: 1 }, data });
}

// ------------------------------------------------------------------ citas

export const PAGE_SIZE = 25;

export async function listAppointments(filters: AppointmentFilters) {
  const s = await settings();
  const where: Prisma.AppointmentWhereInput = {};
  if (filters.from || filters.to) {
    where.startsAt = {
      ...(filters.from ? { gte: zonedToUtc(filters.from, 0, s.timezone) } : {}),
      ...(filters.to ? { lt: zonedToUtc(addDaysISO(filters.to, 1), 0, s.timezone) } : {}),
    };
  }
  if (filters.barberId) where.barberId = filters.barberId;
  if (filters.status) where.status = filters.status;
  if (filters.q) {
    const digits = filters.q.replace(/\D/g, "");
    where.customer = {
      OR: [
        { name: { contains: filters.q, mode: "insensitive" } },
        ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
      ],
    };
  }

  const [total, rows] = await Promise.all([
    db.appointment.count({ where }),
    db.appointment.findMany({
      where,
      orderBy: { startsAt: "desc" },
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
        priceCop: true,
        note: true,
        cancelReason: true,
        barber: { select: { name: true } },
        service: { select: { name: true } },
        customer: { select: { name: true, phone: true } },
      },
    }),
  ]);
  return { total, rows, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Calendario de un día: columnas por barbero con sus citas y bloqueos. */
export async function getCalendarDay(date: DateISO) {
  const s = await settings();
  const start = zonedToUtc(date, 0, s.timezone);
  const end = zonedToUtc(addDaysISO(date, 1), 0, s.timezone);
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();

  const [barbers, hours] = await Promise.all([
    db.barber.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        workingHours: { where: { dayOfWeek: dow }, orderBy: { startMinute: "asc" } },
        appointments: {
          where: { startsAt: { gte: start, lt: end }, status: { not: "CANCELLED" } },
          orderBy: { startsAt: "asc" },
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            status: true,
            service: { select: { name: true } },
            customer: { select: { name: true } },
          },
        },
        timeBlocks: {
          where: { startsAt: { lt: end }, endsAt: { gt: start } },
          select: { id: true, startsAt: true, endsAt: true, reason: true },
        },
      },
    }),
    db.businessHours.findUnique({ where: { dayOfWeek: dow } }),
  ]);
  return { barbers, hours, timezone: s.timezone, dayStart: start };
}

/** Cancelación desde la administración (sin límite de horas). */
export async function adminCancelAppointment(id: string, reason: string | null) {
  const { count } = await db.appointment.updateMany({
    where: { id, status: "CONFIRMED" },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: reason ? `Cancelada por la barbería: ${reason}` : "Cancelada por la barbería",
    },
  });
  if (count === 0) throw new AdminError("Solo se pueden cancelar citas confirmadas.");
}

// ------------------------------------------------------------------ dashboard

export async function getDashboard(now = new Date()) {
  const s = await settings();
  const tz = s.timezone;
  const today = toDateISO(now, tz);
  const weekStart = startOfWeekISO(today);
  const from = addDaysISO(today, -30) < weekStart ? addDaysISO(today, -30) : weekStart;
  const to = addDaysISO(weekStart, 7);

  const [appointments, upcoming] = await Promise.all([
    db.appointment.findMany({
      where: { startsAt: { gte: zonedToUtc(from, 0, tz), lt: zonedToUtc(to, 0, tz) } },
      select: { startsAt: true, status: true, priceCop: true, service: { select: { name: true } } },
    }),
    db.appointment.findMany({
      where: { status: "CONFIRMED", startsAt: { gte: now, lt: zonedToUtc(addDaysISO(today, 1), 0, tz) } },
      orderBy: { startsAt: "asc" },
      take: 8,
      select: {
        id: true,
        startsAt: true,
        barber: { select: { name: true } },
        service: { select: { name: true } },
        customer: { select: { name: true } },
      },
    }),
  ]);

  const stats = computeDashboard(
    appointments.map((a) => ({ startsAt: a.startsAt, status: a.status, priceCop: a.priceCop, serviceName: a.service.name })),
    { now, today, weekStart, timezone: tz },
  );
  return { stats, upcoming, today, weekStart };
}
