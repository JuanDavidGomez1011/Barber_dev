/**
 * Crea (o actualiza) un usuario administrador en la base de datos de .env.
 * Úsalo para el dueño en producción, en vez de los usuarios del seed.
 *
 *   npm run admin:create -- --email dueno@mibarberia.com --name "Nombre Dueño"
 *
 * La contraseña se toma de la variable ADMIN_PASSWORD; si no existe, se genera
 * una aleatoria y se muestra UNA sola vez en la consola.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const { values } = parseArgs({
  options: { email: { type: "string" }, name: { type: "string", default: "Administrador" } },
});
const email = values.email?.trim().toLowerCase();
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Uso: npm run admin:create -- --email correo@dominio.com [--name "Nombre"]');
  process.exit(1);
}

const generated = !process.env.ADMIN_PASSWORD;
const password = process.env.ADMIN_PASSWORD ?? randomBytes(12).toString("base64url");
if (password.length < 8) {
  console.error("ADMIN_PASSWORD debe tener al menos 8 caracteres.");
  process.exit(1);
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.user.upsert({
    where: { email: email! },
    update: { passwordHash, role: "ADMIN", active: true, name: values.name! },
    create: { email: email!, name: values.name!, role: "ADMIN", passwordHash },
  });
  console.log(`✔ Administrador listo: ${user.email}`);
  if (generated) console.log(`  Contraseña generada (guárdala, no se vuelve a mostrar): ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
