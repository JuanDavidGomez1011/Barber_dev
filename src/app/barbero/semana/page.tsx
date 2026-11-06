import Link from "next/link";
import { Suspense } from "react";
import { STATUS_META } from "@/components/status-badge";
import { DateNav } from "@/components/staff/date-nav";
import { cn } from "@/lib/cn";
import { formatCop, formatDayChip } from "@/lib/format";
import { addDaysISO, formatMinute, startOfWeekISO, toDateISO, toMinuteOfDay } from "@/lib/time";
import { requireBarber } from "@/server/auth/dal";
import { getBarberWeek } from "@/server/services/agenda.service";

export default function BarberWeekPage({ searchParams }: PageProps<"/barbero/semana">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-ink-900" />}>
      <WeekAgenda searchParams={searchParams} />
    </Suspense>
  );
}

const isDateISO = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

function weekLabel(start: string) {
  const a = formatDayChip(start);
  const b = formatDayChip(addDaysISO(start, 6));
  return a.month === b.month ? `${a.day} – ${b.day} ${b.month}` : `${a.day} ${a.month} – ${b.day} ${b.month}`;
}

async function WeekAgenda({ searchParams }: Pick<PageProps<"/barbero/semana">, "searchParams">) {
  const { barber } = await requireBarber();
  const { semana } = await searchParams;
  const today = toDateISO(new Date());
  const thisWeek = startOfWeekISO(today);
  const weekStart = startOfWeekISO(isDateISO(semana) ? semana : today);
  const days = await getBarberWeek(barber.id, weekStart);

  const live = days.flatMap((d) => d.appointments).filter((a) => a.status !== "CANCELLED");
  const income = live.filter((a) => a.status !== "NO_SHOW").reduce((s, a) => s + a.priceCop, 0);

  return (
    <div className="space-y-5">
      <DateNav
        prevHref={`/barbero/semana?semana=${addDaysISO(weekStart, -7)}`}
        nextHref={`/barbero/semana?semana=${addDaysISO(weekStart, 7)}`}
        todayHref="/barbero/semana"
        label={weekStart === thisWeek ? "Esta semana" : weekLabel(weekStart)}
        isToday={weekStart === thisWeek}
      />
      <p className="-mt-3 text-center text-sm text-ink-500">
        {weekLabel(weekStart)} · {live.length} citas · {formatCop(income)} estimados
      </p>

      <div className="grid gap-3 md:grid-cols-7 md:gap-2">
        {days.map((day) => {
          const chip = formatDayChip(day.date);
          const appts = day.appointments.filter((a) => a.status !== "CANCELLED");
          const off = day.closedReason || day.shifts.length === 0;
          return (
            <Link
              key={day.date}
              href={day.date === today ? "/barbero" : `/barbero?fecha=${day.date}`}
              className={cn(
                "block rounded-2xl border bg-ink-900 p-3 transition hover:border-brass-500 md:min-h-48",
                day.date === today ? "border-brass-400" : "border-ink-800",
                off && "bg-ink-900/40",
              )}
            >
              <div className="mb-2 flex items-baseline justify-between md:block">
                <p className="text-sm font-semibold">
                  {chip.weekday} {chip.day}
                </p>
                <p className="text-xs text-ink-500">
                  {day.closedReason ? "Cerrado" : day.shifts.length === 0 ? "Libre" : `${appts.length} citas`}
                </p>
              </div>
              <ul className="space-y-1">
                {appts.map((a) => (
                  <li key={a.id} className="flex items-center gap-1.5 text-xs">
                    <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_META[a.status].dot)} />
                    <span className="text-ink-300">{formatMinute(toMinuteOfDay(a.startsAt))}</span>
                    <span className="truncate text-ink-500">{a.customer.name.split(" ")[0]}</span>
                  </li>
                ))}
                {day.blocks.map((b) => (
                  <li key={b.id} className="truncate text-xs text-ink-500">
                    🔒 {b.reason ?? "Bloqueado"}
                  </li>
                ))}
              </ul>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
