import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/** P1001 = no se pudo abrir la conexión: la consulta no llegó a ejecutarse, reintentarla es seguro. */
function isConnectError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P1001";
}

function createClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // Abrir una conexión a una base en la nube puede tardar ~1 s; margen para picos de red.
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
    max: 10,
  });

  return new PrismaClient({ adapter }).$extends({
    name: "retry-on-connect-error",
    query: {
      async $allOperations({ args, query, operation, model }) {
        for (let attempt = 1; ; attempt++) {
          try {
            return await query(args);
          } catch (error) {
            if (!isConnectError(error) || attempt >= 3) throw error;
            const cause = (error as { meta?: { driverAdapterError?: { cause?: unknown } } }).meta?.driverAdapterError?.cause;
            console.warn(`[db] conexión fallida en ${model ?? ""}.${operation} (intento ${attempt}), reintentando`, cause);
            await new Promise((r) => setTimeout(r, 250 * attempt));
          }
        }
      },
    },
  });
}

type Db = ReturnType<typeof createClient>;

// Reutiliza la instancia en desarrollo para no abrir conexiones en cada recarga.
const globalForPrisma = globalThis as unknown as { prisma?: Db };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** Cliente de base de datos (con la extensión de reintento). */
export type DbClient = typeof db;
/** Cliente dentro de una transacción interactiva (`db.$transaction(async (tx) => …)`). */
export type DbTx = Omit<DbClient, "$extends" | "$transaction" | "$connect" | "$disconnect" | "$on" | "$use">;
