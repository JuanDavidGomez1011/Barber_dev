import Link from "next/link";
import { Suspense } from "react";
import { Card, PageTitle, Skeleton } from "@/components/admin/ui";
import { WeekChart } from "@/components/admin/week-chart";
import { formatCop, formatTime } from "@/lib/format";
import { requireAdmin } from "@/server/auth/dal";
import { getDashboard } from "@/server/services/admin.service";

export default function DashboardPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[32rem]" />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  await requireAdmin();
  const { stats, upcoming, today } = await getDashboard();
  const { week, noShow, topServices } = stats;
  const topMax = Math.max(...topServices.map((s) => s.count), 1);

  return (
    <div className="space-y-5">
      <PageTitle title="Resumen" />

      {/* Cifra principal (una sola por vista) + indicadores */}
      <div className="grid gap-3 lg:grid-cols-4">
        <Card className="lg:col-span-2">
          <p className="text-sm text-ink-500">Ingresos estimados esta semana</p>
          <p className="mt-1 text-5xl font-semibold tracking-tight">{formatCop(week.estimatedIncome)}</p>
          <p className="mt-2 text-sm text-ink-500">
            {formatCop(week.completedIncome)} ya cobrados · {week.appointments} citas confirmadas o completadas
          </p>
        </Card>
        <Card>
          <p className="text-sm text-ink-500">Citas de hoy</p>
          <p className="mt-1 text-3xl font-semibold">{stats.today.total}</p>
          <p className="mt-2 text-sm text-ink-500">
            {stats.today.pending} pendientes · {stats.today.completed} completadas
            {stats.today.noShow > 0 && ` · ${stats.today.noShow} ${stats.today.noShow === 1 ? "no asistió" : "no asistieron"}`}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-ink-500">Tasa de inasistencia</p>
          <p className="mt-1 text-3xl font-semibold">
            {noShow.rate === null ? "—" : `${(noShow.rate * 100).toFixed(1).replace(".", ",")} %`}
          </p>
          <p className="mt-2 text-sm text-ink-500">
            Últimos 30 días · {noShow.noShows} de {noShow.noShows + noShow.attended} citas pasadas
          </p>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 font-medium">Citas por día · esta semana</h2>
          <WeekChart days={week.perDay} today={today} />
        </Card>

        <Card>
          <h2 className="mb-4 font-medium">Servicios más pedidos · 30 días</h2>
          {topServices.length === 0 ? (
            <p className="text-sm text-ink-500">Aún no hay citas.</p>
          ) : (
            <ul className="space-y-3">
              {topServices.map((s) => (
                <li key={s.name} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-300">{s.name}</span>
                    <span className="tabular-nums text-ink-100">{s.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-ink-800">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${(s.count / topMax) * 100}%`, background: "var(--color-chart-1)" }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Próximas citas de hoy</h2>
          <Link href="/admin/calendario" className="text-sm text-brass-300 hover:underline">
            Ver calendario
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-ink-500">No quedan citas para hoy.</p>
        ) : (
          <ul className="divide-y divide-ink-800">
            {upcoming.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="w-20 font-semibold tabular-nums">{formatTime(a.startsAt)}</span>
                <span className="flex-1">{a.customer.name}</span>
                <span className="text-ink-500">
                  {a.service.name} · {a.barber.name}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
