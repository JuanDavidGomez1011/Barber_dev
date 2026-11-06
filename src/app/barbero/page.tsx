import { Suspense } from "react";
import { AgendaTimeline } from "@/components/staff/agenda-timeline";
import { DateNav } from "@/components/staff/date-nav";
import { formatCop, formatLongDate } from "@/lib/format";
import { addDaysISO, formatMinute, toDateISO, zonedToUtc } from "@/lib/time";
import { requireBarber } from "@/server/auth/dal";
import { getBarberDay } from "@/server/services/agenda.service";

export default function BarberDayPage({ searchParams }: PageProps<"/barbero">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-ink-900" />}>
      <DayAgenda searchParams={searchParams} />
    </Suspense>
  );
}

const isDateISO = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

async function DayAgenda({ searchParams }: Pick<PageProps<"/barbero">, "searchParams">) {
  const { barber } = await requireBarber();
  const { fecha } = await searchParams;
  const now = new Date();
  const today = toDateISO(now);
  const date = isDateISO(fecha) ? fecha : today;
  const day = await getBarberDay(barber.id, date);

  const live = day.appointments.filter((a) => a.status !== "CANCELLED");
  const done = live.filter((a) => a.status === "COMPLETED").length;
  const pending = live.filter((a) => a.status === "CONFIRMED").length;
  const income = live.filter((a) => a.status !== "NO_SHOW").reduce((sum, a) => sum + a.priceCop, 0);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <DateNav
        prevHref={`/barbero?fecha=${addDaysISO(date, -1)}`}
        nextHref={`/barbero?fecha=${addDaysISO(date, 1)}`}
        todayHref="/barbero"
        label={date === today ? "Hoy" : formatLongDate(zonedToUtc(date, 12 * 60))}
        isToday={date === today}
      />
      {date === today && <p className="-mt-3 text-center text-sm text-ink-500">{formatLongDate(now)}</p>}

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Citas" value={String(live.length)} />
        <Stat label="Pendientes" value={String(pending)} sub={`${done} completadas`} />
        <Stat label="Ingresos est." value={formatCop(income)} />
      </div>

      <p className="text-center text-xs text-ink-500">
        {day.closedReason
          ? `Local cerrado: ${day.closedReason}`
          : day.shifts.length === 0
            ? "Día libre"
            : `Turno: ${day.shifts.map((s) => `${formatMinute(s.startMinute)}–${formatMinute(s.endMinute)}`).join(" y ")}`}
      </p>

      <AgendaTimeline day={day} now={now} />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900 px-2 py-3">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-ink-500">{label}</p>
      {sub && <p className="text-[11px] text-ink-500">{sub}</p>}
    </div>
  );
}
