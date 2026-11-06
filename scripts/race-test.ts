/**
 * Prueba de concurrencia contra la base de datos configurada en .env:
 * lanza varias reservas simultáneas al mismo horario y verifica que solo
 * se acepten las que caben. Borra lo que crea al terminar.
 *
 *   npm run test:race
 */
import "dotenv/config";
import { db } from "@/server/db";
import { getAvailability } from "@/server/services/availability.service";
import { createBooking } from "@/server/services/booking.service";
import { addDaysISO, toDateISO } from "@/lib/time";

const N = 6;

async function race(label: string, serviceId: string, barberId: string | null, startsAt: string) {
  const results = await Promise.allSettled(
    Array.from({ length: N }, (_, i) =>
      createBooking({
        serviceId,
        barberId,
        startsAt: new Date(startsAt),
        name: `Prueba concurrencia ${i}`,
        phone: `+57399000${String(i).padStart(4, "0")}`,
        note: "race-test",
      }),
    ),
  );
  const ok = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof createBooking>>>[];
  const errors = results.filter((r) => r.status === "rejected").map((r) => (r as PromiseRejectedResult).reason?.code ?? String((r as PromiseRejectedResult).reason));
  console.log(`${label}: ${ok.length} éxito(s), errores:`, errors, "barberos:", ok.map((r) => r.value.appointment.barberId));
}

async function main() {
  const service = await db.service.findFirstOrThrow({ where: { name: "Corte clásico" } });
  const date = addDaysISO(toDateISO(new Date()), 2);
  const avail = await getAvailability(db, { serviceId: service.id, barberId: null, from: date, days: 7 });

  const single = avail.days.flatMap((d) => d.slots).find((s) => s.barberIds.length >= 1)!;
  await race(`Mismo barbero (${single.time})`, service.id, single.barberIds[0], single.startsAt);

  const multi = avail.days.flatMap((d) => d.slots).find((s) => s.barberIds.length >= 2 && s.startsAt !== single.startsAt)!;
  await race(`"Cualquiera" con ${multi.barberIds.length} libres (${multi.time})`, service.id, null, multi.startsAt);

  // Limpieza
  const deleted = await db.appointment.deleteMany({ where: { note: "race-test" } });
  await db.customer.deleteMany({ where: { phone: { startsWith: "+57399000" } } });
  console.log(`Limpieza: ${deleted.count} citas de prueba borradas`);
}

main().finally(() => db.$disconnect());
