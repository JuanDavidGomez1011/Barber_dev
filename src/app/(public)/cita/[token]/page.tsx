import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppointmentActions } from "@/components/booking/appointment-actions";
import { CopyLinkButton } from "@/components/booking/copy-link-button";
import { StatusBadge } from "@/components/status-badge";
import { formatCop, formatDuration, formatLongDate, formatPhone, formatTime } from "@/lib/format";
import { getCatalog } from "@/server/catalog";
import { getAppointmentByToken, modificationWindow } from "@/server/services/booking.service";

export const metadata: Metadata = {
  title: "Tu cita",
  // Página privada (enlace con token): que no la indexen los buscadores.
  robots: { index: false, follow: false },
};

export default function CitaPage({ params, searchParams }: PageProps<"/cita/[token]">) {
  return (
    <div className="pt-6">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-ink-900" />}>
        <AppointmentDetails params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** Formato de fechas de Google Calendar: 20261110T143000Z */
const gcalDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

async function AppointmentDetails({ params, searchParams }: PageProps<"/cita/[token]">) {
  // Cada visita consulta la cita en ese momento (estado actual, no una copia prerenderizada).
  await connection();
  const { token } = await params;
  const { nueva } = await searchParams;
  const [appointment, { business, barbers }] = await Promise.all([getAppointmentByToken(token), getCatalog()]);
  if (!appointment) notFound();

  const { canModify, deadline } = modificationWindow(appointment, business.cancelLimitMinutes);
  const isNew = nueva === "1" && appointment.status === "CONFIRMED";

  const calendarUrl =
    "https://calendar.google.com/calendar/render?" +
    new URLSearchParams({
      action: "TEMPLATE",
      text: `${appointment.service.name} · ${business.name}`,
      dates: `${gcalDate(appointment.startsAt)}/${gcalDate(appointment.endsAt)}`,
      details: `Barbero: ${appointment.barber.name}`,
      location: [business.address, business.city].filter(Boolean).join(", "),
    });

  return (
    <div className="space-y-6">
      {isNew && (
        <div className="space-y-1 rounded-2xl border border-emerald-800 bg-emerald-950/50 p-4">
          <p className="font-display text-xl font-semibold text-emerald-200">¡Reserva confirmada!</p>
          <p className="text-sm text-emerald-100/80">
            Guarda este enlace: con él puedes cancelar o reprogramar tu cita. También te lo enviaremos por WhatsApp.
          </p>
        </div>
      )}

      <section className="space-y-4 rounded-2xl border border-ink-800 bg-ink-900 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-ink-500">Hola, {appointment.customer.name.split(" ")[0]}</p>
            <h1 className="font-display text-2xl font-semibold">{appointment.service.name}</h1>
          </div>
          <StatusBadge status={appointment.status} />
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-ink-500">Fecha</dt>
          <dd>{formatLongDate(appointment.startsAt)}</dd>
          <dt className="text-ink-500">Hora</dt>
          <dd>
            {formatTime(appointment.startsAt)} – {formatTime(appointment.endsAt)}{" "}
            <span className="text-ink-500">({formatDuration(appointment.durationMin)})</span>
          </dd>
          <dt className="text-ink-500">Barbero</dt>
          <dd>{appointment.barber.name}</dd>
          <dt className="text-ink-500">Precio</dt>
          <dd className="font-semibold text-brass-300">{formatCop(appointment.priceCop)}</dd>
          <dt className="text-ink-500">WhatsApp</dt>
          <dd>{formatPhone(appointment.customer.phone)}</dd>
          {appointment.note && (
            <>
              <dt className="text-ink-500">Nota</dt>
              <dd className="text-ink-300">{appointment.note}</dd>
            </>
          )}
          {business.address && (
            <>
              <dt className="text-ink-500">Dirección</dt>
              <dd>
                {business.address}, {business.city}
              </dd>
            </>
          )}
        </dl>

        {appointment.status === "CONFIRMED" && (
          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href={calendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-ink-700 px-4 py-2 text-sm transition hover:border-brass-500"
            >
              Agregar a Google Calendar
            </a>
            <CopyLinkButton />
          </div>
        )}
      </section>

      {appointment.status === "CONFIRMED" && (
        <AppointmentActions
          token={token}
          canModify={canModify}
          deadline={deadline.toISOString()}
          serviceId={appointment.service.id}
          currentBarberId={appointment.barber.id}
          barbers={barbers.filter((b) => b.serviceIds.includes(appointment.service.id)).map((b) => ({ id: b.id, name: b.name }))}
          whatsapp={business.whatsapp}
          cancelLimitHours={Math.round(business.cancelLimitMinutes / 60)}
        />
      )}
    </div>
  );
}
