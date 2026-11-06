/**
 * Prepara una base de datos NUEVA (producción) con lo mínimo para que la app
 * funcione: la fila de ajustes y el horario del local. No borra ni toca nada
 * que ya exista. Luego: npm run admin:create y el resto desde el panel.
 *
 *   npm run db:bootstrap
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

async function main() {
  const settings = await db.businessSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: "Mi Barbería", city: "Colombia" },
  });
  console.log(`Ajustes: ${settings.name} (${settings.city})`);

  let created = 0;
  for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
    const exists = await db.businessHours.findUnique({ where: { dayOfWeek } });
    if (exists) continue;
    // Lunes a sábado 9:00–20:00, domingo cerrado. Se cambia en Admin → Horarios.
    await db.businessHours.create({ data: { dayOfWeek, isClosed: dayOfWeek === 0, openMinute: 540, closeMinute: 1200 } });
    created++;
  }
  console.log(created ? `Horario del local: ${created} días creados` : "Horario del local: ya existía");
  console.log("\nSiguiente paso: npm run admin:create -- --email tu@correo.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
