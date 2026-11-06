import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { decryptToken } from "@/lib/crypto";
import {
  isStale,
  MAX_ATTEMPTS,
  planReminders,
  retryDelayMinutes,
  STALE_SENDING_MIN,
  type NotificationType,
} from "@/lib/notifications/rules";
import { renderMessage } from "@/lib/notifications/templates";
import { db } from "../db";
import { getProvider } from ".";

export type AppointmentEvent = "created" | "rescheduled" | "cancelled";

/** URL pública del sitio, para armar los enlaces de los mensajes. */
export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

/**
 * Motivo que se le cuenta al cliente: solo si canceló la barbería (si canceló él
 * mismo, repetírselo sobra). Ver `adminCancelAppointment`.
 */
function businessCancelReason(reason: string | null): string | null {
  const prefix = "Cancelada por la barbería";
  if (!reason?.startsWith(prefix)) return null;
  return reason.slice(prefix.length).replace(/^:\s*/, "") || "La barbería tuvo que cancelar la cita";
}

/** Crea o reactiva la notificación (una por cita y tipo). */
function upsert(appointmentId: string, type: NotificationType, scheduledFor: Date) {
  const reset = { scheduledFor, status: "PENDING" as const, attempts: 0, error: null, sentAt: null, providerMessageId: null };
  return db.notification.upsert({
    where: { appointmentId_type: { appointmentId, type } },
    update: reset,
    create: { appointmentId, type, ...reset },
  });
}

// ------------------------------------------------------------------ programar

/**
 * Actualiza la cola según lo que le pasó a la cita:
 * - creada: confirmación ya + recordatorios 24 h y 2 h antes
 * - reprogramada: aviso del cambio ya + recordatorios recalculados
 * - cancelada: se anulan los pendientes + aviso de cancelación ya
 */
export async function scheduleForAppointment(appointmentId: string, event: AppointmentEvent, now = new Date()) {
  const appt = await db.appointment.findUniqueOrThrow({ where: { id: appointmentId }, select: { startsAt: true } });

  if (event === "cancelled" || event === "rescheduled") {
    await db.notification.updateMany({
      where: { appointmentId, status: "PENDING", type: { not: "CANCELLATION" } },
      data: { status: "CANCELLED", error: event === "cancelled" ? "La cita se canceló" : "La cita se reprogramó" },
    });
  }

  if (event === "cancelled") {
    await upsert(appointmentId, "CANCELLATION", now);
    return;
  }

  await upsert(appointmentId, event === "created" ? "CONFIRMATION" : "RESCHEDULE", now);
  for (const r of planReminders(appt.startsAt, now)) await upsert(appointmentId, r.type, r.scheduledFor);
}

/** Versión que nunca rompe el flujo principal: una reserva no falla porque falle la cola. */
export async function safeSchedule(appointmentId: string, event: AppointmentEvent) {
  try {
    await scheduleForAppointment(appointmentId, event);
  } catch (error) {
    console.error(`[notificaciones] no se pudo programar (${event}) para la cita ${appointmentId}`, error);
  }
}

// ------------------------------------------------------------------ enviar

export interface DispatchSummary {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
  skipped: number;
}

/**
 * Toma hasta `limit` notificaciones vencidas y las envía.
 *
 * Seguro ante ejecuciones simultáneas (el cron y el envío inmediato tras una
 * reserva pueden coincidir): cada una se "reclama" con `FOR UPDATE SKIP LOCKED`
 * y pasa a SENDING, así dos procesos nunca toman la misma.
 */
export async function processDue(opts: { now?: Date; limit?: number; appointmentId?: string } = {}): Promise<DispatchSummary> {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 25;
  const stale = new Date(now.getTime() - STALE_SENDING_MIN * 60_000);
  const onlyAppointment = opts.appointmentId ? Prisma.sql`AND "appointmentId" = ${opts.appointmentId}` : Prisma.empty;

  const claimed = await db.$queryRaw<{ id: string }[]>`
    UPDATE "Notification" SET "status" = 'SENDING', "updatedAt" = ${now}
    WHERE "id" IN (
      SELECT "id" FROM "Notification"
      WHERE (("status" = 'PENDING' AND "scheduledFor" <= ${now})
          OR ("status" = 'SENDING' AND "updatedAt" < ${stale}))
        ${onlyAppointment}
      ORDER BY "scheduledFor"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id"`;

  const summary: DispatchSummary = { claimed: claimed.length, sent: 0, retried: 0, failed: 0, skipped: 0 };
  if (claimed.length === 0) return summary;

  const [settings, provider] = [await db.businessSettings.findUniqueOrThrow({ where: { id: 1 } }), getProvider()];

  for (const { id } of claimed) {
    const n = await db.notification.findUniqueOrThrow({
      where: { id },
      include: {
        appointment: {
          include: {
            customer: { select: { name: true, phone: true } },
            service: { select: { name: true } },
            barber: { select: { name: true } },
          },
        },
      },
    });
    const appt = n.appointment;

    const staleReason = isStale(n, appt, now);
    if (staleReason) {
      await db.notification.update({ where: { id }, data: { status: "CANCELLED", error: staleReason } });
      summary.skipped++;
      continue;
    }

    const token = appt.manageTokenEnc ? decryptToken(appt.manageTokenEnc) : null;
    const message = renderMessage(n.type, {
      businessName: settings.name,
      customerName: appt.customer.name,
      serviceName: appt.service.name,
      barberName: appt.barber.name,
      startsAt: appt.startsAt,
      timezone: settings.timezone,
      address: settings.address,
      manageUrl: token ? `${appUrl()}/cita/${token}` : null,
      cancelReason: businessCancelReason(appt.cancelReason),
    });

    const result = await provider.send({ to: appt.customer.phone, type: n.type, ...message });
    const attempts = n.attempts + 1;

    if (result.ok) {
      await db.notification.update({
        where: { id },
        data: { status: "SENT", sentAt: new Date(), attempts, error: null, providerMessageId: result.providerMessageId ?? null },
      });
      summary.sent++;
    } else if (result.retryable && attempts < MAX_ATTEMPTS) {
      await db.notification.update({
        where: { id },
        data: {
          status: "PENDING",
          attempts,
          error: result.error,
          scheduledFor: new Date(now.getTime() + retryDelayMinutes(attempts) * 60_000),
        },
      });
      summary.retried++;
    } else {
      await db.notification.update({ where: { id }, data: { status: "FAILED", attempts, error: result.error } });
      summary.failed++;
    }
  }

  if (summary.claimed > 0) console.info(`[notificaciones] ${provider.name}:`, summary);
  return summary;
}

// ------------------------------------------------------------------ consultar (admin)

export async function listNotifications(filters: { status?: string; page?: number }) {
  const page = Math.max(1, filters.page ?? 1);
  const statuses = ["PENDING", "SENDING", "SENT", "FAILED", "CANCELLED"] as const;
  const status = statuses.find((s) => s === filters.status);
  const where = status ? { status } : {};
  const pageSize = 30;

  const [total, rows, counts, settings] = await Promise.all([
    db.notification.count({ where }),
    db.notification.findMany({
      where,
      // Pendientes: la próxima primero. Resto: la más reciente primero.
      orderBy: status === "PENDING" ? { scheduledFor: "asc" } : { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        appointment: {
          select: {
            startsAt: true,
            cancelReason: true,
            customer: { select: { name: true, phone: true } },
            service: { select: { name: true } },
            barber: { select: { name: true } },
          },
        },
      },
    }),
    db.notification.groupBy({ by: ["status"], _count: { _all: true } }),
    db.businessSettings.findUniqueOrThrow({ where: { id: 1 } }),
  ]);

  return {
    total,
    page,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Record<string, number>,
    rows: rows.map((n) => ({
      ...n,
      // Vista previa sin el enlace real (el token no se muestra en el panel).
      preview: renderMessage(n.type, {
        businessName: settings.name,
        customerName: n.appointment.customer.name,
        serviceName: n.appointment.service.name,
        barberName: n.appointment.barber.name,
        startsAt: n.appointment.startsAt,
        timezone: settings.timezone,
        address: settings.address,
        manageUrl: `${appUrl()}/cita/••••••`,
        cancelReason: businessCancelReason(n.appointment.cancelReason),
      }).body,
    })),
  };
}

export async function retryNotification(id: string) {
  const { count } = await db.notification.updateMany({
    where: { id, status: { in: ["FAILED", "CANCELLED"] } },
    data: { status: "PENDING", scheduledFor: new Date(), attempts: 0, error: null },
  });
  return count > 0;
}
