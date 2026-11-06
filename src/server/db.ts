import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // Abrir una conexión a una base en la nube puede tardar ~1 s; margen para picos de red.
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
    max: 10,
  });
  return new PrismaClient({ adapter });
}

// Reutiliza la instancia en desarrollo para no abrir conexiones en cada recarga.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
