import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppointmentActions } from "@/components/booking/appointment-actions";
import { CopyLinkButton } from "@/components/booking/copy-link-button";
import { Notice, textLink } from "@/components/public/ui";
import { cn } from "@/lib/cn";
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
    <div className="mx-auto max-w-xl pt-10 sm:pt-14">
      <Suspense fallback={<div className="h-96 animate-pulse bg-paper-deep/60" />}>
        <AppointmentDetails params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** Formato de fechas de Google Calendar: 20261110T143000Z */
const gcalDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  CONFIRMED: { label: "Confirmada", className: "border-moss text-moss" },
  COMPLETED: { label: "Atendida", className: "border-char-mute text-char-mute" },
  CANCELLED: { label: "Cancelada", className: "border-oxblood text-oxblood" },
  NO_SHOW: { label: "No asistió", className: "border-oxblood text-oxblood" },
};

async function AppointmentDetails({ params, searchParams }: PageProps<"/cita/[token]">) {
  // Cada visita consulta la cita en ese momento (estado actual, no una copia prerenderizada).
  await connection();
  const { token } = await params;
  const { nueva } = await searchParams;
  const [appointment, { business, barbers }] = await Promise.all([getAppointmentByToken(token), getCatalog()]);
  if (!appointment) notFound();

  const { canModify, deadline } = modificationWindow(appointment, business.cancelLimitMinutes);
  const isNew = nueva === "1" && appointment.status === "CONFIRMED";
  const status = STATUS_LABEL[appointment.status];
  const inactive = appointment.status === "CANCELLED" || appointment.status === "NO_SHOW";

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
    <div className="space-y-8">
      {isNew && (
        <div className="space-y-2 text-center">
          <p className="label-caps text-moss">Reserva confirmada</p>
          <p className="font-serif text-[2.2rem] leading-tight tracking-tight">
            Te esperamos, {appointment.customer.name.split(" ")[0]}.
          </p>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-char-mute">
            Guarda este enlace: con él puedes cancelar o cambiar la hora. También te lo enviamos por WhatsApp.
          </p>
        </div>
      )}

      {/* Comprobante */}
      <article className={cn("border border-char/80 bg-paper-light shadow-[6px_6px_0_0_var(--color-paper-deep)]", inactive && "opacity-80")}>
        <header className="flex items-center justify-between gap-4 border-b border-char/80 px-6 py-3.5">
          <p className="label-caps text-char-soft">{business.name}</p>
          <span className={cn("label-caps border px-2 py-1 !text-[0.62rem]", status.className)}>{status.label}</span>
        </header>

        <div className="space-y-1 px-6 pt-7 pb-6">
          {!isNew && <p className="text-sm text-char-mute">Hola, {appointment.customer.name.split(" ")[0]}</p>}
          <h1 className={cn("font-serif text-[2rem] leading-tight tracking-tight", inactive && "line-through decoration-1")}>
            {appointment.service.name}
          </h1>
          <p className="text-char-soft">con {appointment.barber.name}</p>
        </div>

        <div className="perforation mx-6" aria-hidden />

        <div className="grid divide-y divide-rule/60 sm:grid-cols-[1.5fr_1fr] sm:divide-x sm:divide-y-0">
          <div className="px-6 py-5">
            <p className="label-caps mb-2 text-char-mute">Día</p>
            <p className="font-serif text-xl leading-snug">{formatLongDate(appointment.startsAt)}</p>
          </div>
          <div className="px-6 py-5">
            <p className="label-caps mb-2 text-char-mute">Hora</p>
            <p className="font-serif text-xl leading-snug">{formatTime(appointment.startsAt)}</p>
            <p className="mt-0.5 text-xs text-char-mute">
              hasta {formatTime(appointment.endsAt)} · {formatDuration(appointment.durationMin)}
            </p>
          </div>
        </div>

        <div className="perforation mx-6" aria-hidden />

        <dl className="divide-y divide-rule/60 px-6 py-2 text-sm">
          <Row label="Precio" value={<span className="font-serif text-lg text-oxblood">{formatCop(appointment.priceCop)}</span>} />
          <Row label="WhatsApp" value={formatPhone(appointment.customer.phone)} />
          {business.address && <Row label="Dirección" value={`${business.address}, ${business.city}`} />}
          {appointment.note && <Row label="Nota" value={<span className="italic text-char-soft">{appointment.note}</span>} />}
        </dl>

        {appointment.status === "CONFIRMED" && (
          <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-rule/70 px-6 py-4 text-sm">
            <a href={calendarUrl} target="_blank" rel="noopener noreferrer" className={textLink}>
              Agregar al calendario
            </a>
            <CopyLinkButton />
          </footer>
        )}
      </article>

      {appointment.status === "CANCELLED" && (
        <Notice tone="info">
          Esta cita fue cancelada.{" "}
          <Link href="/reservar" className={textLink}>
            Reservar otra
          </Link>
        </Notice>
      )}

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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-3">
      <dt className="label-caps shrink-0 text-char-mute">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
