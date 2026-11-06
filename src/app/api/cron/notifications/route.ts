import { headers } from "next/headers";
import { pruneLoginAttempts } from "@/server/auth/login-limit";
import { processDue } from "@/server/notifications/service";

/**
 * GET /api/cron/notifications — envía las notificaciones vencidas (recordatorios
 * 24 h y 2 h, reintentos). Debe llamarse cada 5 minutos desde un cron externo
 * (ver README) con el encabezado `Authorization: Bearer <CRON_SECRET>`.
 * Vercel Cron manda ese encabezado solo si CRON_SECRET está definido.
 */
export async function GET() {
  const secret = process.env.CRON_SECRET;
  const auth = (await headers()).get("authorization");

  if (!secret) {
    // En desarrollo se permite sin secreto para poder probarlo a mano.
    if (process.env.NODE_ENV === "production") {
      return Response.json({ error: "CRON_SECRET no está configurado" }, { status: 500 });
    }
  } else if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  // Varias tandas por llamada, por si hay acumuladas (p. ej. tras una caída).
  const total = { claimed: 0, sent: 0, retried: 0, failed: 0, skipped: 0 };
  for (let i = 0; i < 4; i++) {
    const batch = await processDue({ limit: 25 });
    for (const k of Object.keys(total) as (keyof typeof total)[]) total[k] += batch[k];
    if (batch.claimed < 25) break;
  }

  // Limpieza de paso: intentos de login que ya no cuentan para el límite.
  const prunedLoginAttempts = await pruneLoginAttempts().catch((e) => {
    console.error("[cron] limpieza de intentos de login", e);
    return 0;
  });

  return Response.json({ ok: true, ...total, prunedLoginAttempts }, { headers: { "Cache-Control": "no-store" } });
}
