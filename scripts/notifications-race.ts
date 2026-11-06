/**
 * Prueba de concurrencia del envío de notificaciones contra la base de .env:
 * pone 10 recordatorios pendientes como "vencidos", lanza 3 procesos de envío
 * a la vez y verifica que cada mensaje se envió exactamente una vez.
 * Al final los deja como estaban.
 *
 *   npm run test:notifications-race
 */
import "dotenv/config";
import { db } from "@/server/db";
import { processDue } from "@/server/notifications/service";

async function main() {
  const now = new Date();
  const sample = await db.notification.findMany({
    where: { status: "PENDING", type: { in: ["REMINDER_24H", "REMINDER_2H"] }, appointment: { status: "CONFIRMED", startsAt: { gt: new Date(now.getTime() + 3 * 3600_000) } } },
    take: 10,
    select: { id: true, scheduledFor: true },
  });
  if (sample.length === 0) {
    console.log("No hay recordatorios pendientes para probar (corre npm run db:seed).");
    return;
  }
  const ids = sample.map((s) => s.id);
  await db.notification.updateMany({ where: { id: { in: ids } }, data: { scheduledFor: now } });

  // Tres procesos compitiendo por la misma cola, como el cron y un envío inmediato que coinciden.
  const results = await Promise.all([1, 2, 3].map(() => processDue({ now, limit: 10 })));
  const after = await db.notification.findMany({ where: { id: { in: ids } }, select: { status: true, attempts: true } });

  const claimedTotal = results.reduce((s, r) => s + r.claimed, 0);
  const sent = after.filter((n) => n.status === "SENT").length;
  const duplicated = after.filter((n) => n.attempts > 1).length;
  console.log(`Procesos: ${results.map((r) => r.claimed).join(" + ")} = ${claimedTotal} reclamadas`);
  console.log(`Enviadas: ${sent} de ${ids.length} · con más de un intento (duplicadas): ${duplicated}`);
  console.log(sent === ids.length && duplicated === 0 ? "✔ Cada mensaje se envió una sola vez" : "✗ Algo no cuadra");

  // Restaurar
  for (const s of sample) {
    await db.notification.update({
      where: { id: s.id },
      data: { status: "PENDING", scheduledFor: s.scheduledFor, attempts: 0, sentAt: null, providerMessageId: null, error: null },
    });
  }
  console.log("Recordatorios restaurados a su estado original.");
}

main().finally(() => db.$disconnect());
