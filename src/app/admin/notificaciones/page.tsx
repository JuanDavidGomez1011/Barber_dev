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
  PENDING: { label: "Pendiente", className: "border-sky-700/40 bg-sky-100 text-sky-800" },
  SENDING: { label: "Enviando", className: "border-sky-700/40 bg-sky-100 text-sky-800" },
  SENT: { label: "Enviada", className: "border-moss/40 bg-moss/10 text-moss" },
  FAILED: { label: "Falló", className: "border-oxblood/50 bg-oxblood/10 text-oxblood" },
  CANCELLED: { label: "Descartada", className: "border-rule bg-paper-deep text-char-soft" },
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
        "border px-3 py-1 text-sm transition-colors",
        status === key ? "border-char bg-paper-deep text-char" : "border-rule text-char-soft hover:border-char-mute",
      )}
    >
      {label}
      {count !== undefined && <span className="ml-1.5 tabular-nums text-char-mute">{count}</span>}
    </Link>
  );

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm">
          <p>
            Proveedor activo: <span className="font-semibold text-oxblood">{provider}</span>
          </p>
          <p className="text-char-mute">
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
        <p className=" border border-dashed border-rule p-8 text-center text-sm text-char-mute">No hay notificaciones.</p>
      ) : (
        <ul className="divide-y divide-rule overflow-hidden border border-rule bg-paper-light">
          {data.rows.map((n) => (
            <li key={n.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-sm">
                  <p className="font-medium">
                    {TYPE_LABEL[n.type]} · {n.appointment.customer.name}{" "}
                    <span className="font-normal text-char-mute">{formatPhone(n.appointment.customer.phone)}</span>
                  </p>
                  <p className="text-char-mute">
                    Cita: {formatLongDate(n.appointment.startsAt)}, {formatTime(n.appointment.startsAt)} · {n.appointment.service.name} con{" "}
                    {n.appointment.barber.name}
                  </p>
                  <p className="text-xs text-char-mute">
                    {n.status === "SENT" && n.sentAt
                      ? `Enviada ${formatLongDate(n.sentAt).toLowerCase()}, ${formatTime(n.sentAt)}`
                      : `Programada para ${formatLongDate(n.scheduledFor).toLowerCase()}, ${formatTime(n.scheduledFor)}`}
                    {n.attempts > 0 && ` · ${n.attempts} ${n.attempts === 1 ? "intento" : "intentos"}`}
                    {n.providerMessageId && ` · ID ${n.providerMessageId}`}
                  </p>
                  {n.error && <p className="text-xs text-oxblood/80">{n.error}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("label-caps border px-2 py-1 !text-[0.62rem]", STATUS[n.status].className)}>
                    {STATUS[n.status].label}
                  </span>
                  {(n.status === "FAILED" || n.status === "CANCELLED") && (
                    <ConfirmActionButton action={retryNotificationAction.bind(null, n.id)} label="Reintentar" confirmLabel="¿Enviar de nuevo?" variant="secondary" />
                  )}
                </div>
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-xs text-oxblood">Ver mensaje</summary>
                <pre className="mt-2 max-w-xl whitespace-pre-wrap bg-moss/10 p-3 font-body text-sm text-char">{n.preview}</pre>
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
