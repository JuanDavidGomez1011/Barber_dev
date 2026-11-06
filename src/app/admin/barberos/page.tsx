import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonClass, PageTitle, Skeleton } from "@/components/admin/ui";
import { cn } from "@/lib/cn";
import { formatMinute } from "@/lib/time";
import { requireAdmin } from "@/server/auth/dal";
import { listBarbers } from "@/server/services/admin.service";

export const metadata: Metadata = { title: "Barberos" };
const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function BarbersPage() {
  return (
    <>
      <PageTitle
        title="Barberos"
        action={
          <Link href="/admin/barberos/nuevo" className={buttonClass.primary}>
            + Nuevo barbero
          </Link>
        }
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Barbers />
      </Suspense>
    </>
  );
}

async function Barbers() {
  await requireAdmin();
  const barbers = await listBarbers();

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {barbers.map((b) => {
        const days = [1, 2, 3, 4, 5, 6, 0]
          .map((d) => ({ d, shifts: b.workingHours.filter((w) => w.dayOfWeek === d) }))
          .filter((x) => x.shifts.length > 0);
        return (
          <li key={b.id}>
            <Link
              href={`/admin/barberos/${b.id}`}
              className={cn("block space-y-2 rounded-2xl border border-ink-800 bg-ink-900 p-4 transition hover:border-brass-500", !b.active && "opacity-60")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {b.name} {!b.active && <span className="text-xs text-ink-500">(inactivo)</span>}
                  </p>
                  <p className="text-sm text-ink-500">{b.user?.email ?? "Sin usuario de acceso"}</p>
                </div>
                <span className="text-sm text-brass-300">Editar →</span>
              </div>
              <p className="text-sm text-ink-300">{b.services.map((s) => s.service.name).join(" · ") || "Sin servicios asignados"}</p>
              <p className="text-xs text-ink-500">
                {days.length === 0
                  ? "Sin horario: no aparece en las reservas"
                  : days
                      .map(({ d, shifts }) => `${DAY_SHORT[d]} ${shifts.map((s) => `${formatMinute(s.startMinute)}–${formatMinute(s.endMinute)}`).join(", ")}`)
                      .join(" · ")}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
