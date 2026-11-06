import "dotenv/config";
import { defineConfig } from "prisma/config";

// Las migraciones usan la conexión directa (DIRECT_URL). En Supabase, el
// pooler en modo transacción (puerto 6543) no sirve para migrar.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
