import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import { Card, Checkbox, Field, inputClass, PageTitle, Skeleton } from "@/components/admin/ui";
import { cn } from "@/lib/cn";
import { formatCop, formatDuration } from "@/lib/format";
import { deleteServiceAction, saveServiceAction } from "@/server/actions/admin";
import { requireAdmin } from "@/server/auth/dal";
import { listServices } from "@/server/services/admin.service";

export const metadata: Metadata = { title: "Servicios" };

export default function ServicesPage() {
  return (
    <>
      <PageTitle
        title="Servicios"
        description="Cambiar precio o duración no afecta las citas ya agendadas: cada una guarda los valores con que se reservó."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Services />
      </Suspense>
    </>
  );
}

type ServiceValues = { id?: string; name?: string; description?: string | null; durationMin?: number; priceCop?: number; sortOrder?: number; active?: boolean };

function ServiceFields({ s }: { s: ServiceValues }) {
  return (
    <>
      {s.id && <input type="hidden" name="id" value={s.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre">
          <input name="name" required maxLength={60} defaultValue={s.name} className={inputClass} />
        </Field>
        <Field label="Descripción (opcional)">
          <input name="description" maxLength={200} defaultValue={s.description ?? ""} className={inputClass} />
        </Field>
        <Field label="Duración (minutos)" hint="Múltiplo de 5">
          <input name="durationMin" type="number" required min={5} max={480} step={5} defaultValue={s.durationMin ?? 30} className={inputClass} />
        </Field>
        <Field label="Precio (COP)">
          <input name="priceCop" type="number" required min={0} step={500} defaultValue={s.priceCop ?? 25000} className={inputClass} />
        </Field>
        <Field label="Orden en la lista" hint="Menor = aparece primero">
          <input name="sortOrder" type="number" min={0} max={999} defaultValue={s.sortOrder ?? 0} className={inputClass} />
        </Field>
        <div className="flex items-end pb-2">
          <Checkbox name="active" label="Visible para reservar" defaultChecked={s.active ?? true} />
        </div>
      </div>
    </>
  );
}

async function Services() {
  await requireAdmin();
  const services = await listServices();

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_22rem] lg:items-start">
      <ul className="space-y-3">
        {services.map((s) => (
          <li key={s.id}>
            <details className={cn("group rounded-2xl border border-ink-800 bg-ink-900", !s.active && "opacity-60")}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {s.name} {!s.active && <span className="text-xs text-ink-500">(oculto)</span>}
                  </p>
                  <p className="text-sm text-ink-500">
                    {formatDuration(s.durationMin)} · {s._count.barbers} barberos · {s._count.appointments} citas en total
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-brass-300">{formatCop(s.priceCop)}</span>
                  <span className="text-ink-500 transition group-open:rotate-180">⌄</span>
                </div>
              </summary>
              <div className="space-y-4 border-t border-ink-800 p-4">
                <ActionForm action={saveServiceAction}>
                  <ServiceFields s={s} />
                </ActionForm>
                <div className="border-t border-ink-800 pt-3">
                  <ConfirmActionButton
                    action={deleteServiceAction.bind(null, s.id)}
                    label="Eliminar servicio"
                    confirmLabel={s._count.appointments > 0 ? "Tiene historial; mejor ocúltalo. ¿Intentar igual?" : "¿Eliminar?"}
                  />
                </div>
              </div>
            </details>
          </li>
        ))}
      </ul>

      <Card>
        <h2 className="mb-3 font-display text-xl font-semibold">Nuevo servicio</h2>
        <ActionForm action={saveServiceAction} submitLabel="Crear servicio" resetOnSuccess>
          <ServiceFields s={{}} />
        </ActionForm>
      </Card>
    </div>
  );
}
