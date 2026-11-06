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
          <p className="label-caps text-char-mute">Ingresos estimados esta semana</p>
          <p className="mt-2 font-serif text-5xl tracking-tight">{formatCop(week.estimatedIncome)}</p>
          <p className="mt-2 text-sm text-char-mute">
            {formatCop(week.completedIncome)} ya cobrados · {week.appointments} citas confirmadas o completadas
          </p>
        </Card>
        <Card>
          <p className="label-caps text-char-mute">Citas de hoy</p>
          <p className="mt-2 font-serif text-4xl">{stats.today.total}</p>
          <p className="mt-2 text-sm text-char-mute">
            {stats.today.pending} pendientes · {stats.today.completed} completadas
            {stats.today.noShow > 0 && ` · ${stats.today.noShow} ${stats.today.noShow === 1 ? "no asistió" : "no asistieron"}`}
          </p>
        </Card>
        <Card>
          <p className="label-caps text-char-mute">Tasa de inasistencia</p>
          <p className="mt-2 font-serif text-4xl">
            {noShow.rate === null ? "—" : `${(noShow.rate * 100).toFixed(1).replace(".", ",")} %`}
          </p>
          <p className="mt-2 text-sm text-char-mute">
            Últimos 30 días · {noShow.noShows} de {noShow.noShows + noShow.attended} citas pasadas
          </p>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="label-caps mb-5 text-char-soft">Citas por día · esta semana</h2>
          <WeekChart days={week.perDay} today={today} />
        </Card>

        <Card>
          <h2 className="label-caps mb-5 text-char-soft">Servicios más pedidos · 30 días</h2>
          {topServices.length === 0 ? (
            <p className="text-sm text-char-mute">Aún no hay citas.</p>
          ) : (
            <ul className="space-y-3">
              {topServices.map((s) => (
                <li key={s.name} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-char-soft">{s.name}</span>
                    <span className="tabular-nums text-char">{s.count}</span>
                  </div>
                  <div className="h-1.5 bg-paper-deep">
                    <div
                      className="h-1.5"
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
          <h2 className="label-caps text-char-soft">Próximas citas de hoy</h2>
          <Link href="/admin/calendario" className="text-sm text-oxblood underline decoration-oxblood/30 underline-offset-4 hover:decoration-oxblood">
            Ver calendario
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-char-mute">No quedan citas para hoy.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {upcoming.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="w-20 font-serif text-base tabular-nums">{formatTime(a.startsAt)}</span>
                <span className="flex-1">{a.customer.name}</span>
                <span className="text-char-mute">
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
