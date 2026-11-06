import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import { buttonClass, Card, PageTitle, Skeleton } from "@/components/admin/ui";
import { cn } from "@/lib/cn";
import { formatLongDate, formatPhone, formatTime } from "@/lib/format";
import { processNotificationsNowAction, retryNotificationAction } from "@/server/actions/admin";
import { requireAdmin } from "@/server/auth/dal";
import { listNotifications } from "@/server/notifications/service";

export const metadata: Metadata = { title: "Notificaciones" };

const TYPE_LABEL: Record<string, string> = {
  CONFIRMATION: "Confirmación",
  REMINDER_24H: "Recordatorio 24 h",
  REMINDER_2H: "Recordatorio 2 h",
  RESCHEDULE: "Reprogramación",
  CANCELLATION: "Cancelación",
};

const STATUS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pendiente", className: "border-sky-800 bg-sky-950 text-sky-300" },
  SENDING: { label: "Enviando", className: "border-sky-800 bg-sky-950 text-sky-300" },
  SENT: { label: "Enviada", className: "border-emerald-800 bg-emerald-950 text-emerald-300" },
  FAILED: { label: "Falló", className: "border-red-900 bg-red-950 text-red-300" },
  CANCELLED: { label: "Descartada", className: "border-ink-700 bg-ink-800 text-ink-300" },
};

export default function NotificationsPage({ searchParams }: PageProps<"/admin/notificaciones">) {
  return (
    <>
      <PageTitle
        title="Notificaciones por WhatsApp"
        description="Confirmaciones, recordatorios (24 h y 2 h antes), cambios y cancelaciones. Los recordatorios salen con el cron cada 5 minutos."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Notifications searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Notifications({ searchParams }: Pick<PageProps<"/admin/notificaciones">, "searchParams">) {
  await requireAdmin();
  const { estado, page } = await searchParams;
  const status = typeof estado === "string" ? estado : undefined;
  const data = await listNotifications({ status, page: Number(page) || 1 });
  const provider = process.env.NOTIFICATIONS_PROVIDER ?? "console";

  const chip = (key: string | undefined, label: string, count?: number) => (
    <Link
      href={key ? `/admin/notificaciones?estado=${key}` : "/admin/notificaciones"}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition",
        status === key ? "border-brass-400 bg-ink-800 text-ink-100" : "border-ink-700 text-ink-300 hover:border-ink-500",
      )}
    >
      {label}
      {count !== undefined && <span className="ml-1.5 tabular-nums text-ink-500">{count}</span>}
    </Link>
  );

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm">
          <p>
            Proveedor activo: <span className="font-semibold text-brass-300">{provider}</span>
          </p>
          <p className="text-ink-500">
            {provider === "console"
              ? "Modo simulado: los mensajes se escriben en los logs del servidor, no se envían."
              : "Los mensajes se envían de verdad por WhatsApp."}
          </p>
        </div>
        <ActionForm action={processNotificationsNowAction} submitLabel="Enviar pendientes ahora">
          {null}
        </ActionForm>
      </Card>

      <div className="flex flex-wrap gap-2">
        {chip(undefined, "Todas")}
        {chip("PENDING", "Pendientes", data.counts.PENDING ?? 0)}
        {chip("SENT", "Enviadas", data.counts.SENT ?? 0)}
        {chip("FAILED", "Fallidas", data.counts.FAILED ?? 0)}
        {chip("CANCELLED", "Descartadas", data.counts.CANCELLED ?? 0)}
      </div>

      {data.rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-800 p-8 text-center text-sm text-ink-500">No hay notificaciones.</p>
      ) : (
        <ul className="divide-y divide-ink-800 overflow-hidden rounded-2xl border border-ink-800 bg-ink-900">
          {data.rows.map((n) => (
            <li key={n.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-sm">
                  <p className="font-medium">
                    {TYPE_LABEL[n.type]} · {n.appointment.customer.name}{" "}
                    <span className="font-normal text-ink-500">{formatPhone(n.appointment.customer.phone)}</span>
                  </p>
                  <p className="text-ink-500">
                    Cita: {formatLongDate(n.appointment.startsAt)}, {formatTime(n.appointment.startsAt)} · {n.appointment.service.name} con{" "}
                    {n.appointment.barber.name}
                  </p>
                  <p className="text-xs text-ink-500">
                    {n.status === "SENT" && n.sentAt
                      ? `Enviada ${formatLongDate(n.sentAt).toLowerCase()}, ${formatTime(n.sentAt)}`
                      : `Programada para ${formatLongDate(n.scheduledFor).toLowerCase()}, ${formatTime(n.scheduledFor)}`}
                    {n.attempts > 0 && ` · ${n.attempts} ${n.attempts === 1 ? "intento" : "intentos"}`}
                    {n.providerMessageId && ` · ID ${n.providerMessageId}`}
                  </p>
                  {n.error && <p className="text-xs text-red-300/80">{n.error}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", STATUS[n.status].className)}>
                    {STATUS[n.status].label}
                  </span>
                  {(n.status === "FAILED" || n.status === "CANCELLED") && (
                    <ConfirmActionButton action={retryNotificationAction.bind(null, n.id)} label="Reintentar" confirmLabel="¿Enviar de nuevo?" variant="secondary" />
                  )}
                </div>
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-xs text-brass-300">Ver mensaje</summary>
                <pre className="mt-2 max-w-xl whitespace-pre-wrap rounded-xl bg-emerald-950/40 p-3 font-sans text-ink-100">{n.preview}</pre>
              </details>
            </li>
          ))}
        </ul>
      )}

      {data.pages > 1 && (
        <nav className="flex justify-center gap-2" aria-label="Paginación">
          {data.page > 1 && (
            <Link href={`/admin/notificaciones?${new URLSearchParams({ ...(status ? { estado: status } : {}), page: String(data.page - 1) })}`} className={buttonClass.secondary}>
              ← Anterior
            </Link>
          )}
          {data.page < data.pages && (
            <Link href={`/admin/notificaciones?${new URLSearchParams({ ...(status ? { estado: status } : {}), page: String(data.page + 1) })}`} className={buttonClass.secondary}>
              Siguiente →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
