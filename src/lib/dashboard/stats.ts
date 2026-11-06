/**
 * Métricas del dashboard. Función pura: recibe las citas ya cargadas y las
 * fechas de referencia; no consulta la base de datos (probada en tests/dashboard).
 */
import { addDaysISO, toDateISO, type DateISO } from "../time";

export type Status = "CONFIRMED" | "COMPLETED" | "NO_SHOW" | "CANCELLED";

export interface StatAppointment {
  startsAt: Date;
  status: Status;
  priceCop: number;
  serviceName: string;
}

export interface DashboardStats {
  today: { total: number; pending: number; completed: number; noShow: number; cancelled: number };
  week: {
    /** Confirmadas + completadas de lunes a domingo. */
    estimatedIncome: number;
    /** Solo completadas (lo que ya entró). */
    completedIncome: number;
    appointments: number;
    perDay: { date: DateISO; count: number; income: number }[];
  };
  /** Últimos 30 días (sin canceladas), los 5 más pedidos. */
  topServices: { name: string; count: number }[];
  /** Últimos 30 días, citas ya pasadas: inasistencias / (completadas + inasistencias). */
  noShow: { rate: number | null; noShows: number; attended: number };
}

const billable = (s: Status) => s === "CONFIRMED" || s === "COMPLETED";

export function computeDashboard(
  appointments: StatAppointment[],
  ref: { now: Date; today: DateISO; weekStart: DateISO; timezone: string },
): DashboardStats {
  const { now, today, weekStart, timezone } = ref;
  const weekEnd = addDaysISO(weekStart, 6);
  const monthAgo = addDaysISO(today, -30);

  const todayStats = { total: 0, pending: 0, completed: 0, noShow: 0, cancelled: 0 };
  const perDay = new Map<DateISO, { count: number; income: number }>();
  for (let d = weekStart; d <= weekEnd; d = addDaysISO(d, 1)) perDay.set(d, { count: 0, income: 0 });
  let estimatedIncome = 0;
  let completedIncome = 0;
  const services = new Map<string, number>();
  let noShows = 0;
  let attended = 0;

  for (const a of appointments) {
    const date = toDateISO(a.startsAt, timezone);

    if (date === today) {
      if (a.status === "CANCELLED") todayStats.cancelled++;
      else {
        todayStats.total++;
        if (a.status === "CONFIRMED") todayStats.pending++;
        if (a.status === "COMPLETED") todayStats.completed++;
        if (a.status === "NO_SHOW") todayStats.noShow++;
      }
    }

    const day = perDay.get(date);
    if (day && billable(a.status)) {
      day.count++;
      day.income += a.priceCop;
      estimatedIncome += a.priceCop;
      if (a.status === "COMPLETED") completedIncome += a.priceCop;
    }

    if (date >= monthAgo && date <= today) {
      if (a.status !== "CANCELLED") services.set(a.serviceName, (services.get(a.serviceName) ?? 0) + 1);
      if (a.startsAt <= now) {
        if (a.status === "NO_SHOW") noShows++;
        if (a.status === "COMPLETED") attended++;
      }
    }
  }

  const weekDays = [...perDay.entries()].map(([date, v]) => ({ date, ...v }));
  const total = noShows + attended;

  return {
    today: todayStats,
    week: {
      estimatedIncome,
      completedIncome,
      appointments: weekDays.reduce((s, d) => s + d.count, 0),
      perDay: weekDays,
    },
    topServices: [...services.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 5),
    noShow: { rate: total === 0 ? null : noShows / total, noShows, attended },
  };
}
