import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageTitle, Skeleton } from "@/components/admin/ui";
import { STATUS_META } from "@/components/status-badge";
import { DateNav } from "@/components/staff/date-nav";
import { cn } from "@/lib/cn";
import { formatLongDate } from "@/lib/format";
import { addDaysISO, formatMinute, toDateISO, toMinuteOfDay, zonedToUtc } from "@/lib/time";
import { requireAdmin } from "@/server/auth/dal";
import { getCalendarDay } from "@/server/services/admin.service";

export const metadata: Metadata = { title: "Calendario" };

/** Píxeles por minuto en la grilla (1 h = 72 px). */
const PPM = 1.2;
const isDateISO = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export default function CalendarPage({ searchParams }: PageProps<"/admin/calendario">) {
  return (
    <>
      <PageTitle title="Calendario" description="Citas del día por barbero. Las franjas claras son los turnos de cada uno." />
      <Suspense fallback={<Skeleton className="h-[40rem]" />}>
        <Calendar searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Calendar({ searchParams }: Pick<PageProps<"/admin/calendario">, "searchParams">) {
  await requireAdmin();
  const { fecha } = await searchParams;
  const today = toDateISO(new Date());
  const date = isDateISO(fecha) ? fecha : today;
  const { barbers, hours, timezone } = await getCalendarDay(date);

  // Rango visible: horario del local (o 8:00–21:00 si ese día está cerrado), en horas completas.
  const from = Math.floor((hours && !hours.isClosed ? hours.openMinute : 8 * 60) / 60) * 60;
  const to = Math.ceil((hours && !hours.isClosed ? hours.closeMinute : 21 * 60) / 60) * 60;
  const height = (to - from) * PPM;
  const y = (minute: number) => (Math.min(Math.max(minute, from), to) - from) * PPM;
  const minuteOf = (d: Date) => (toDateISO(d, timezone) === date ? toMinuteOfDay(d, timezone) : d < zonedToUtc(date, 0, timezone) ? 0 : 24 * 60);
  const hourMarks = Array.from({ length: (to - from) / 60 + 1 }, (_, i) => from + i * 60);

  return (
    <div className="space-y-4">
      <DateNav
        prevHref={`/admin/calendario?fecha=${addDaysISO(date, -1)}`}
        nextHref={`/admin/calendario?fecha=${addDaysISO(date, 1)}`}
        todayHref="/admin/calendario"
        label={date === today ? "Hoy" : formatLongDate(zonedToUtc(date, 12 * 60, timezone))}
        isToday={date === today}
      />
      {hours?.isClosed && <p className="text-center text-sm text-amber-300">El local está cerrado este día de la semana.</p>}

      <div className="overflow-x-auto rounded-2xl border border-ink-800 bg-ink-900">
        <div className="flex min-w-max">
          {/* Eje de horas */}
          <div className="sticky left-0 z-10 w-14 shrink-0 border-r border-ink-800 bg-ink-900">
            <div className="h-10 border-b border-ink-800" />
            <div className="relative" style={{ height }}>
              {hourMarks.map((m) => (
                <span key={m} className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-ink-500" style={{ top: y(m) }}>
                  {formatMinute(m)}
                </span>
              ))}
            </div>
          </div>

          {barbers.map((b) => (
            <div key={b.id} className="w-44 shrink-0 border-r border-ink-800 last:border-r-0">
              <div className="flex h-10 items-center justify-between border-b border-ink-800 px-3 text-sm font-medium">
                <span className="truncate">{b.name}</span>
                <span className="text-xs text-ink-500">{b.appointments.length}</span>
              </div>
              <div className="relative bg-ink-950/60" style={{ height }}>
                {hourMarks.map((m) => (
                  <div key={m} className="absolute inset-x-0 h-px bg-ink-800/70" style={{ top: y(m) }} />
                ))}
                {b.workingHours.map((w) => (
                  <div
                    key={w.id}
                    className="absolute inset-x-0 bg-ink-900"
                    style={{ top: y(w.startMinute), height: y(w.endMinute) - y(w.startMinute) }}
                  />
                ))}
                {b.timeBlocks.map((t) => {
                  const top = y(minuteOf(t.startsAt));
                  return (
                    <div
                      key={t.id}
                      className="absolute inset-x-1 overflow-hidden rounded-md border border-dashed border-ink-700 bg-[repeating-linear-gradient(45deg,transparent_0_6px,rgb(58_50_43/0.5)_6px_8px)] px-2 py-1 text-[11px] text-ink-500"
                      style={{ top, height: Math.max(y(minuteOf(t.endsAt)) - top, 14) }}
                    >
                      {t.reason ?? "Bloqueado"}
                    </div>
                  );
                })}
                {b.appointments.map((a) => {
                  const top = y(minuteOf(a.startsAt));
                  const h = Math.max(y(minuteOf(a.endsAt)) - top - 2, 18);
                  return (
                    <Link
                      key={a.id}
                      href={`/admin/citas?from=${date}&to=${date}&barberId=${b.id}&q=${encodeURIComponent(a.customer.name)}`}
                      className={cn(
                        "absolute inset-x-1 overflow-hidden rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-[11px] leading-tight transition hover:border-brass-500",
                        a.status !== "CONFIRMED" && "opacity-70",
                      )}
                      style={{ top: top + 1, height: h }}
                      title={`${formatMinute(minuteOf(a.startsAt))} ${a.customer.name} · ${a.service.name} · ${STATUS_META[a.status].label}`}
                    >
                      <span className="flex items-center gap-1 font-semibold text-ink-100">
                        <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_META[a.status].dot)} />
                        {formatMinute(minuteOf(a.startsAt))} {a.customer.name.split(" ")[0]}
                      </span>
                      {h > 30 && <span className="block truncate text-ink-500">{a.service.name}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ul className="flex flex-wrap gap-4 text-xs text-ink-500">
        {(["CONFIRMED", "COMPLETED", "NO_SHOW"] as const).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", STATUS_META[s].dot)} /> {STATUS_META[s].label}
          </li>
        ))}
        <li>Canceladas no se muestran</li>
      </ul>
    </div>
  );
}
