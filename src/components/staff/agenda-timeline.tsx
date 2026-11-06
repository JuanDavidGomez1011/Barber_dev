import { cn } from "@/lib/cn";
import { formatCop, formatPhone, formatTime } from "@/lib/format";
import type { AgendaDay } from "@/server/services/agenda.service";
import { StatusBadge } from "../status-badge";
import { StatusActions } from "./status-actions";

type Item =
  | { kind: "appointment"; start: number; data: AgendaDay["appointments"][number] }
  | { kind: "block"; start: number; data: AgendaDay["blocks"][number] };

/** Lista del día: citas y bloqueos en orden. Las canceladas van aparte, al final. */
export function AgendaTimeline({ day, now }: { day: AgendaDay; now: Date }) {
  const active = day.appointments.filter((a) => a.status !== "CANCELLED");
  const cancelled = day.appointments.filter((a) => a.status === "CANCELLED");
  const items: Item[] = [
    ...active.map((a) => ({ kind: "appointment" as const, start: a.startsAt.getTime(), data: a })),
    ...day.blocks.map((b) => ({ kind: "block" as const, start: b.startsAt.getTime(), data: b })),
  ].sort((a, b) => a.start - b.start);

  if (items.length === 0 && cancelled.length === 0) {
    return (
      <p className=" border border-dashed border-rule p-8 text-center text-sm text-char-mute">
        No hay citas para este día.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        {items.map((item) =>
          item.kind === "block" ? (
            <li
              key={`b-${item.data.id}`}
              className="flex items-center justify-between border border-dashed border-rule bg-paper-light/40 px-4 py-3 text-sm"
            >
              <span className="text-char-soft">
                {formatTime(item.data.startsAt)} – {formatTime(item.data.endsAt)}
              </span>
              <span className="text-char-mute">🔒 {item.data.reason ?? "Bloqueado"}</span>
            </li>
          ) : (
            <AppointmentCard key={item.data.id} appt={item.data} now={now} />
          ),
        )}
      </ol>

      {cancelled.length > 0 && (
        <details className=" border border-rule px-4 py-3 text-sm">
          <summary className="cursor-pointer text-char-mute">Canceladas ({cancelled.length})</summary>
          <ul className="mt-3 space-y-2 text-char-mute">
            {cancelled.map((a) => (
              <li key={a.id} className="flex justify-between gap-3">
                <span>
                  {formatTime(a.startsAt)} · {a.customer.name}
                </span>
                <span>{a.service.name}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function AppointmentCard({ appt, now }: { appt: AgendaDay["appointments"][number]; now: Date }) {
  const started = appt.startsAt <= now;
  const inProgress = started && appt.endsAt > now && appt.status === "CONFIRMED";
  const wa = `https://wa.me/${appt.customer.phone.replace(/\D/g, "")}`;

  return (
    <li
      className={cn(
        "space-y-3 border bg-paper-light p-4",
        inProgress ? "border-char" : "border-rule",
        appt.status !== "CONFIRMED" && "opacity-75",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-serif text-xl">
            {formatTime(appt.startsAt)} <span className="font-body text-sm text-char-mute">– {formatTime(appt.endsAt)}</span>
          </p>
          <p className="text-sm text-char-soft">
            {appt.service.name} · <span className="text-oxblood">{formatCop(appt.priceCop)}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={appt.status} />
          {inProgress && <span className="text-xs font-semibold text-oxblood">En curso</span>}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{appt.customer.name}</span>
        <a href={wa} target="_blank" rel="noopener noreferrer" className="text-moss hover:underline">
          {formatPhone(appt.customer.phone)}
        </a>
      </div>
      {appt.note && <p className=" bg-paper-deep/60 px-3 py-2 text-sm text-char-soft">“{appt.note}”</p>}

      <StatusActions appointmentId={appt.id} status={appt.status} started={started} />
    </li>
  );
}
