import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppointmentRowActions } from "@/components/admin/appointment-row-actions";
import { buttonClass, Card, Field, inputClass, PageTitle, Skeleton } from "@/components/admin/ui";
import { StatusBadge } from "@/components/status-badge";
import { formatCop, formatLongDate, formatPhone, formatTime } from "@/lib/format";
import { appointmentFiltersSchema } from "@/lib/validation/admin";
import { requireAdmin } from "@/server/auth/dal";
import { listAppointments, listBarbers } from "@/server/services/admin.service";

export const metadata: Metadata = { title: "Citas" };

export default function AppointmentsPage({ searchParams }: PageProps<"/admin/citas">) {
  return (
    <>
      <PageTitle title="Citas" description="Todas las citas, con filtros. Las más recientes primero." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Appointments searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Appointments({ searchParams }: Pick<PageProps<"/admin/citas">, "searchParams">) {
  await requireAdmin();
  const raw = await searchParams;
  const filters = appointmentFiltersSchema.parse(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v || undefined])),
  );
  const [{ rows, total, pages }, barbers] = await Promise.all([listAppointments(filters), listBarbers()]);
  const now = new Date();

  const pageHref = (page: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v && k !== "page") p.set(k, String(v));
    p.set("page", String(page));
    return `/admin/citas?${p}`;
  };

  return (
    <div className="space-y-4">
      {/* Filtros en una sola fila (formulario GET: la URL se puede compartir) */}
      <Card>
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
          <Field label="Desde">
            <input type="date" name="from" defaultValue={filters.from} className={inputClass} />
          </Field>
          <Field label="Hasta">
            <input type="date" name="to" defaultValue={filters.to} className={inputClass} />
          </Field>
          <Field label="Barbero">
            <select name="barberId" defaultValue={filters.barberId ?? ""} className={inputClass}>
              <option value="">Todos</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estado">
            <select name="status" defaultValue={filters.status ?? ""} className={inputClass}>
              <option value="">Todos</option>
              <option value="CONFIRMED">Confirmada</option>
              <option value="COMPLETED">Completada</option>
              <option value="NO_SHOW">No asistió</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
          </Field>
          <Field label="Cliente">
            <input name="q" defaultValue={filters.q} placeholder="Nombre o teléfono" className={inputClass} />
          </Field>
          <div className="flex gap-2">
            <button type="submit" className={buttonClass.primary}>
              Filtrar
            </button>
            <Link href="/admin/citas" className={buttonClass.secondary}>
              Limpiar
            </Link>
          </div>
        </form>
      </Card>

      <p className="text-sm text-char-mute">
        {total} {total === 1 ? "cita" : "citas"}
        {pages > 1 && ` · página ${filters.page} de ${pages}`}
      </p>

      {rows.length === 0 ? (
        <p className=" border border-dashed border-rule p-8 text-center text-sm text-char-mute">
          No hay citas con esos filtros.
        </p>
      ) : (
        <ul className="divide-y divide-rule overflow-hidden border border-rule bg-paper-light">
          {rows.map((a) => (
            <li key={a.id} className="grid gap-2 p-4 md:grid-cols-[11rem_1fr_auto] md:items-center">
              <div>
                <p className="font-medium">{formatLongDate(a.startsAt)}</p>
                <p className="text-sm text-char-mute tabular-nums">
                  {formatTime(a.startsAt)} – {formatTime(a.endsAt)}
                </p>
              </div>
              <div className="min-w-0 text-sm">
                <p>
                  <span className="font-medium">{a.customer.name}</span>{" "}
                  <a
                    href={`https://wa.me/${a.customer.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-moss hover:underline"
                  >
                    {formatPhone(a.customer.phone)}
                  </a>
                </p>
                <p className="text-char-mute">
                  {a.service.name} · {a.barber.name} · {formatCop(a.priceCop)}
                </p>
                {a.note && <p className="truncate text-char-mute">“{a.note}”</p>}
                {a.cancelReason && <p className="text-xs text-oxblood/80">{a.cancelReason}</p>}
              </div>
              <div className="flex flex-col items-start gap-2 md:items-end">
                <StatusBadge status={a.status} />
                <AppointmentRowActions id={a.id} status={a.status} started={a.startsAt <= now} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="flex justify-center gap-2" aria-label="Paginación">
          {filters.page > 1 && (
            <Link href={pageHref(filters.page - 1)} className={buttonClass.secondary}>
              ← Anterior
            </Link>
          )}
          {filters.page < pages && (
            <Link href={pageHref(filters.page + 1)} className={buttonClass.secondary}>
              Siguiente →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
