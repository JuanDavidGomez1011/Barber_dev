/**
 * Datos de ejemplo: 3 barberos, 5 servicios, horarios, festivos y citas
 * de prueba (pasadas y futuras). Borra los datos existentes: solo desarrollo.
 *
 *   npm run db:seed
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type AppointmentStatus, type Prisma } from "../src/generated/prisma/client";
import {
  addDaysISO,
  dateISOToDbDate,
  dayOfWeekISO,
  toDateISO,
  zonedToUtc,
  type DateISO,
} from "../src/lib/time";
import { encryptToken } from "../src/lib/crypto";
import { planReminders } from "../src/lib/notifications/rules";
import { generateManageToken, hashToken } from "../src/lib/tokens";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "true") {
  console.error("El seed borra datos. Para correrlo en producción define ALLOW_SEED=true.");
  process.exit(1);
}

// Sin contraseña por defecto en el código: cada quien define la suya en .env.
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "";
if (SEED_PASSWORD.length < 8) {
  console.error("Define SEED_PASSWORD en .env (mínimo 8 caracteres): es la contraseña de los usuarios de ejemplo.");
  process.exit(1);
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

const h = (hh: number, mm = 0) => hh * 60 + mm;

/** PRNG determinista para que el seed genere siempre los mismos datos. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261105);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];

// ------------------------------------------------------------------ datos

const SERVICES = [
  { key: "corte", name: "Corte clásico", description: "Corte a tijera o máquina, lavado y peinado.", durationMin: 30, priceCop: 25000 },
  { key: "corte-barba", name: "Corte + barba", description: "Corte completo y perfilado de barba.", durationMin: 60, priceCop: 40000 },
  { key: "barba", name: "Arreglo de barba", description: "Perfilado, rebajado y toalla caliente.", durationMin: 30, priceCop: 18000 },
  { key: "infantil", name: "Corte infantil", description: "Para niños menores de 12 años.", durationMin: 30, priceCop: 20000 },
  { key: "afeitado", name: "Afeitado clásico", description: "Afeitado con navaja y toalla caliente.", durationMin: 45, priceCop: 30000 },
] as const;
type ServiceKey = (typeof SERVICES)[number]["key"];

type Shift = [dayOfWeek: number, start: number, end: number];

const BARBERS: {
  slug: string;
  name: string;
  email: string;
  bio: string;
  services: ServiceKey[];
  shifts: Shift[];
}[] = [
  {
    slug: "carlos",
    name: "Carlos Ramírez",
    email: "carlos@barberia.local",
    bio: "15 años de experiencia. Especialista en cortes clásicos y afeitado.",
    services: ["corte", "corte-barba", "barba", "infantil", "afeitado"],
    // Turno partido lunes a viernes, sábado corrido.
    shifts: [1, 2, 3, 4, 5].flatMap((d): Shift[] => [[d, h(9), h(13)], [d, h(14), h(19)]]).concat([[6, h(9), h(15)]]),
  },
  {
    slug: "andres",
    name: "Andrés Moreno",
    email: "andres@barberia.local",
    bio: "Degradados, diseños y estilos modernos.",
    services: ["corte", "corte-barba", "barba", "infantil"],
    shifts: [2, 3, 4, 5, 6].map((d): Shift => [d, h(10), h(20)]),
  },
  {
    slug: "miguel",
    name: "Miguel Torres",
    email: "miguel@barberia.local",
    bio: "Cortes rápidos y precisos. Paciente con los más pequeños.",
    services: ["corte", "corte-barba", "infantil"],
    shifts: [1, 2, 3, 4, 5, 6].map((d): Shift => [d, h(9), h(17)]),
  },
];

const CUSTOMERS = [
  ["Juan Pérez", "+573001112233"],
  ["Santiago Gómez", "+573102223344"],
  ["Mateo Rodríguez", "+573203334455"],
  ["Sebastián López", "+573014445566"],
  ["Daniel Martínez", "+573125556677"],
  ["Felipe Castro", "+573156667788"],
  ["Alejandro Vargas", "+573177778899"],
  ["Nicolás Herrera", "+573188889900"],
  ["Samuel Ríos", "+573199990011"],
  ["David Ospina", "+573220001122"],
] as const;

// Festivos de Colombia próximos (Ley Emiliani: algunos se trasladan al lunes).
const HOLIDAYS: [DateISO, string][] = [
  ["2026-11-16", "Independencia de Cartagena"],
  ["2026-12-08", "Día de la Inmaculada Concepción"],
  ["2026-12-25", "Navidad"],
  ["2027-01-01", "Año Nuevo"],
  ["2027-01-11", "Día de los Reyes Magos"],
];

const NOTES = [null, null, null, null, "Por favor dejar la parte de arriba larga.", "Primera vez en la barbería.", "Llego desde el trabajo, quizás 5 min tarde."];

/** Token fijo de una cita de ejemplo para probar el enlace de gestión sin buscarlo. */
const DEMO_TOKEN = "demo-cita-ejemplo";

// ------------------------------------------------------------------ seed

/**
 * Segunda barrera, además de NODE_ENV (que en local casi nunca está definido):
 * si la base tiene usuarios que no son los de ejemplo (p. ej. el admin real que
 * crea `admin:create`), probablemente es producción y no se borra nada.
 */
async function assertLooksLikeDevDatabase() {
  if (process.env.ALLOW_SEED === "true") return;
  const realUsers = await db.user.findMany({
    where: { NOT: { email: { endsWith: "@barberia.local" } } },
    select: { email: true },
    take: 3,
  });
  if (realUsers.length > 0) {
    console.error(
      `Esta base tiene usuarios reales (${realUsers.map((u) => u.email).join(", ")}). ` +
        "El seed borraría todo, así que no se corrió.\n" +
        "Revisa que DATABASE_URL/DIRECT_URL apunten a la base de desarrollo. " +
        "Si de verdad quieres borrarla, corre de nuevo con ALLOW_SEED=true.",
    );
    process.exit(1);
  }
}

async function main() {
  await assertLooksLikeDevDatabase();
  console.log("Limpiando datos…");
  await db.$transaction([
    db.loginAttempt.deleteMany(),
    db.notification.deleteMany(),
    db.appointment.deleteMany(),
    db.timeBlock.deleteMany(),
    db.workingHours.deleteMany(),
    db.barberService.deleteMany(),
    db.barber.deleteMany(),
    db.service.deleteMany(),
    db.customer.deleteMany(),
    db.user.deleteMany(),
    db.closedDay.deleteMany(),
    db.businessHours.deleteMany(),
    db.businessSettings.deleteMany(),
  ]);

  console.log("Configuración del negocio…");
  await db.businessSettings.create({
    data: {
      id: 1,
      name: "Nombre de la Barbería", // se cambia luego desde Admin → Ajustes
      city: "Ciudad, Colombia",
      address: "Calle 00 # 00-00",
      whatsapp: "+573000000000",
    },
  });

  // Lunes a sábado 9:00–20:00, domingo cerrado.
  await db.businessHours.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((d) => ({
      dayOfWeek: d,
      isClosed: d === 0,
      openMinute: h(9),
      closeMinute: h(20),
    })),
  });

  await db.closedDay.createMany({
    data: HOLIDAYS.map(([date, reason]) => ({ date: dateISOToDbDate(date), reason })),
  });

  console.log("Usuarios, servicios y barberos…");
  const password = SEED_PASSWORD;
  const passwordHash = await bcrypt.hash(password, 10);

  await db.user.create({
    data: { email: "admin@barberia.local", name: "Dueño", role: "ADMIN", passwordHash },
  });

  const serviceIds = {} as Record<ServiceKey, string>;
  for (const [i, s] of SERVICES.entries()) {
    const created = await db.service.create({
      data: { name: s.name, description: s.description, durationMin: s.durationMin, priceCop: s.priceCop, sortOrder: i },
    });
    serviceIds[s.key] = created.id;
  }

  const barberIds: Record<string, string> = {};
  for (const [i, b] of BARBERS.entries()) {
    const created = await db.barber.create({
      data: {
        slug: b.slug,
        name: b.name,
        bio: b.bio,
        sortOrder: i,
        user: { create: { email: b.email, name: b.name, role: "BARBER", passwordHash } },
        services: { create: b.services.map((k) => ({ serviceId: serviceIds[k] })) },
        workingHours: {
          create: b.shifts.map(([dayOfWeek, startMinute, endMinute]) => ({ dayOfWeek, startMinute, endMinute })),
        },
      },
    });
    barberIds[b.slug] = created.id;
  }

  const customers = await db.customer.createManyAndReturn({
    data: CUSTOMERS.map(([name, phone]) => ({ name, phone })),
  });

  // ---- Bloqueos de horario
  const now = new Date();
  const today = toDateISO(now);
  const holidaySet = new Set(HOLIDAYS.map(([d]) => d));

  /** Próxima fecha (desde `from`) en que el barbero trabaja y no es festivo. */
  const nextWorkday = (slug: string, from: DateISO) => {
    const b = BARBERS.find((x) => x.slug === slug)!;
    let d = from;
    while (holidaySet.has(d) || !b.shifts.some(([dow]) => dow === dayOfWeekISO(d))) d = addDaysISO(d, 1);
    return d;
  };

  const blocks: { barberSlug: string; date: DateISO; start: number; end: number; reason: string }[] = [];
  // Almuerzo diario de Andrés y Miguel durante las próximas 2 semanas.
  for (let i = 0; i < 14; i++) {
    const d = addDaysISO(today, i);
    if (holidaySet.has(d)) continue;
    const dow = dayOfWeekISO(d);
    if (dow >= 2 && dow <= 6) blocks.push({ barberSlug: "andres", date: d, start: h(13), end: h(14), reason: "Almuerzo" });
    if (dow >= 1 && dow <= 6) blocks.push({ barberSlug: "miguel", date: d, start: h(12, 30), end: h(13, 30), reason: "Almuerzo" });
  }
  // Un permiso de media jornada para Carlos.
  blocks.push({ barberSlug: "carlos", date: nextWorkday("carlos", addDaysISO(today, 3)), start: h(14), end: h(19), reason: "Permiso: cita médica" });

  await db.timeBlock.createMany({
    data: blocks.map((b) => ({
      barberId: barberIds[b.barberSlug],
      startsAt: zonedToUtc(b.date, b.start),
      endsAt: zonedToUtc(b.date, b.end),
      reason: b.reason,
    })),
  });

  // ---- Citas: 14 días atrás a 7 días adelante, sin cruces y dentro del horario.
  console.log("Citas de prueba…");
  type NewAppointment = Prisma.AppointmentCreateManyInput;
  const appointments: NewAppointment[] = [];
  let demoAssigned = false;

  for (let offset = -14; offset <= 7; offset++) {
    const date = addDaysISO(today, offset);
    if (holidaySet.has(date)) continue;
    const dow = dayOfWeekISO(date);
    const isPast = offset < 0;

    for (const b of BARBERS) {
      const dayBlocks = blocks.filter((x) => x.barberSlug === b.slug && x.date === date);
      for (const [, shiftStart, shiftEnd] of b.shifts.filter(([d]) => d === dow)) {
        let cursor = shiftStart;
        while (cursor < shiftEnd) {
          // Ocupación: más alta en el pasado, más baja hacia el futuro.
          const occupancy = isPast ? 0.6 : 0.55 - offset * 0.06;
          if (rand() > occupancy) {
            cursor += 30;
            continue;
          }
          const key = pick(b.services);
          const service = SERVICES.find((s) => s.key === key)!;
          const start = cursor;
          const end = start + service.durationMin;
          const crossesBlock = dayBlocks.some((x) => start < x.end && end > x.start);
          if (end > shiftEnd || crossesBlock) {
            cursor += 15;
            continue;
          }

          const startsAt = zonedToUtc(date, start);
          const endsAt = zonedToUtc(date, end);
          let status: AppointmentStatus = "CONFIRMED";
          if (endsAt <= now) {
            const r = rand();
            status = r < 0.8 ? "COMPLETED" : r < 0.9 ? "NO_SHOW" : "CANCELLED";
          } else if (rand() < 0.07) {
            status = "CANCELLED";
          }

          // La primera cita futura confirmada usa el token de demostración.
          let token: string;
          if (!demoAssigned && status === "CONFIRMED" && offset >= 1) {
            token = DEMO_TOKEN;
            demoAssigned = true;
          } else {
            token = generateManageToken().token;
          }

          const customer = pick(customers);
          appointments.push({
            barberId: barberIds[b.slug],
            serviceId: serviceIds[key],
            customerId: customer.id,
            startsAt,
            endsAt,
            status,
            priceCop: service.priceCop,
            durationMin: service.durationMin,
            note: pick(NOTES),
            manageTokenHash: hashToken(token),
            // Cifrado para que los recordatorios puedan incluir el enlace.
            manageTokenEnc: encryptToken(token),
            anyBarber: rand() < 0.25,
            cancelledAt: status === "CANCELLED" ? new Date(startsAt.getTime() - 5 * 3600_000) : null,
            cancelReason: status === "CANCELLED" ? "Cancelada por el cliente" : null,
            createdAt: new Date(startsAt.getTime() - (1 + Math.floor(rand() * 5)) * 86_400_000),
          });
          cursor = end + (rand() < 0.3 ? 15 : 0);
        }
      }
    }
  }

  // Inserción en lote: una sola consulta en vez de cientos (la base está en la nube).
  const created = await db.appointment.createManyAndReturn({
    data: appointments,
    select: { id: true, startsAt: true, status: true, createdAt: true, cancelledAt: true },
  });

  // ---- Historial de notificaciones (WhatsApp simulado)
  console.log("Notificaciones…");
  const notifications: Prisma.NotificationCreateManyInput[] = [];
  for (const a of created) {
    notifications.push({ appointmentId: a.id, type: "CONFIRMATION", scheduledFor: a.createdAt, status: "SENT", sentAt: a.createdAt, attempts: 1 });
    // Recordatorios: los que ya debían salir quedan enviados; los futuros, pendientes.
    for (const r of planReminders(a.startsAt, a.createdAt)) {
      const due = r.scheduledFor <= now;
      if (a.status === "CANCELLED" && a.cancelledAt && r.scheduledFor >= a.cancelledAt) {
        notifications.push({ appointmentId: a.id, type: r.type, scheduledFor: r.scheduledFor, status: "CANCELLED", error: "La cita se canceló" });
      } else {
        notifications.push({
          appointmentId: a.id,
          type: r.type,
          scheduledFor: r.scheduledFor,
          status: due ? "SENT" : "PENDING",
          sentAt: due ? r.scheduledFor : null,
          attempts: due ? 1 : 0,
        });
      }
    }
    if (a.status === "CANCELLED" && a.cancelledAt) {
      notifications.push({ appointmentId: a.id, type: "CANCELLATION", scheduledFor: a.cancelledAt, status: "SENT", sentAt: a.cancelledAt, attempts: 1 });
    }
  }
  await db.notification.createMany({ data: notifications });

  const counts = appointments.reduce<Record<string, number>>((acc, a) => {
    acc[a.status as string] = (acc[a.status as string] ?? 0) + 1;
    return acc;
  }, {});

  console.log("\n✔ Seed completado");
  console.log(`  Servicios: ${SERVICES.length} · Barberos: ${BARBERS.length} · Clientes: ${customers.length}`);
  console.log(`  Bloqueos: ${blocks.length} · Festivos: ${HOLIDAYS.length}`);
  console.log(`  Citas: ${appointments.length}`, counts);
  console.log(`  Notificaciones: ${notifications.length} (${notifications.filter((n) => n.status === "PENDING").length} pendientes)`);
  console.log("\n  Accesos (contraseña: SEED_PASSWORD del .env):");
  console.log("   admin@barberia.local  (administrador)");
  for (const b of BARBERS) console.log(`   ${b.email}  (barbero)`);
  if (demoAssigned) console.log(`\n  Enlace de gestión de ejemplo: /cita/${DEMO_TOKEN}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
