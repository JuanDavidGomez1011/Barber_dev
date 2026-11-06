import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import { Card, Checkbox, Field, inputClass, PageTitle, Skeleton } from "@/components/admin/ui";
import { formatLongDate } from "@/lib/format";
import { formatMinute, toDateISO, zonedToUtc } from "@/lib/time";
import { createClosedDayAction, deleteClosedDayAction, setBusinessHoursAction } from "@/server/actions/admin";
import { requireAdmin } from "@/server/auth/dal";
import { getBusinessHours, listClosedDays } from "@/server/services/admin.service";

export const metadata: Metadata = { title: "Horarios y festivos" };

const DAYS = [
  [1, "Lunes"],
  [2, "Martes"],
  [3, "Miércoles"],
  [4, "Jueves"],
  [5, "Viernes"],
  [6, "Sábado"],
  [0, "Domingo"],
] as const;

export default function HoursPage() {
  return (
    <>
      <PageTitle
        title="Horarios y festivos"
        description="El horario del local es el límite general: nadie recibe reservas fuera de él, aunque su turno sea más largo."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Hours />
      </Suspense>
    </>
  );
}

async function Hours() {
  await requireAdmin();
  const now = new Date();
  const [hours, closedDays] = await Promise.all([getBusinessHours(), listClosedDays(now)]);
  const byDay = new Map(hours.map((h) => [h.dayOfWeek, h]));

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
      <Card>
        <h2 className="mb-4 font-serif text-2xl tracking-tight">Horario de atención</h2>
        <ActionForm action={setBusinessHoursAction}>
          <ul className="divide-y divide-rule border border-rule">
            {DAYS.map(([dow, label]) => {
              const h = byDay.get(dow);
              return (
                <li key={dow} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <span className="w-24 text-sm font-medium">{label}</span>
                  <input type="time" step={900} name={`open_${dow}`} defaultValue={formatMinute(h?.openMinute ?? 540)} className={`${inputClass} w-28 py-1.5 text-sm`} aria-label={`${label}: apertura`} />
                  <span className="text-char-mute">–</span>
                  <input type="time" step={900} name={`close_${dow}`} defaultValue={formatMinute(h?.closeMinute ?? 1200)} className={`${inputClass} w-28 py-1.5 text-sm`} aria-label={`${label}: cierre`} />
                  <Checkbox name={`closed_${dow}`} label="Cerrado" defaultChecked={h?.isClosed ?? false} />
                </li>
              );
            })}
          </ul>
        </ActionForm>
      </Card>

      <div className="space-y-5">
        <Card>
          <h2 className="mb-1 font-serif text-2xl tracking-tight">Festivos y días cerrados</h2>
          <p className="mb-4 text-sm text-char-mute">Ese día no se ofrecen horarios, para ningún barbero.</p>
          <ActionForm action={createClosedDayAction} submitLabel="Agregar día cerrado" resetOnSuccess>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Fecha">
                <input type="date" name="date" required min={toDateISO(now)} className={inputClass} />
              </Field>
              <Field label="Motivo">
                <input name="reason" maxLength={80} placeholder="Ej: Día de la Independencia" className={inputClass} />
              </Field>
            </div>
            <Checkbox name="force" label="Crear de todas formas si ese día hay citas confirmadas" />
          </ActionForm>
        </Card>

        <Card>
          <h3 className="mb-3 font-medium">Próximos</h3>
          {closedDays.length === 0 ? (
            <p className="text-sm text-char-mute">No hay días cerrados próximos.</p>
          ) : (
            <ul className="divide-y divide-rule">
              {closedDays.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="text-sm">
                    <p className="font-medium">{formatLongDate(zonedToUtc(d.date, 12 * 60))}</p>
                    {d.reason && <p className="text-char-mute">{d.reason}</p>}
                  </div>
                  <ConfirmActionButton action={deleteClosedDayAction.bind(null, d.id)} label="Quitar" variant="secondary" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
