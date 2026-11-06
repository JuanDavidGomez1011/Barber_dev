import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { Card, Field, inputClass, PageTitle, Skeleton } from "@/components/admin/ui";
import { formatPhone } from "@/lib/format";
import { saveSettingsAction } from "@/server/actions/admin";
import { requireAdmin } from "@/server/auth/dal";
import { getSettings } from "@/server/services/admin.service";

export const metadata: Metadata = { title: "Ajustes" };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Ajustes" description="Datos del negocio que ven los clientes y reglas de reserva." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  await requireAdmin();
  const s = await getSettings();

  return (
    <Card>
      <ActionForm action={saveSettingsAction}>
        <h2 className="font-serif text-2xl tracking-tight">Negocio</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre de la barbería">
            <input name="name" required maxLength={80} defaultValue={s.name} className={inputClass} />
          </Field>
          <Field label="Ciudad">
            <input name="city" required maxLength={80} defaultValue={s.city} className={inputClass} />
          </Field>
          <Field label="Dirección">
            <input name="address" maxLength={120} defaultValue={s.address ?? ""} className={inputClass} />
          </Field>
          <Field label="WhatsApp del negocio" hint="Los clientes lo usan para pedir cambios fuera de plazo">
            <input name="whatsapp" type="tel" defaultValue={s.whatsapp ? formatPhone(s.whatsapp) : ""} className={inputClass} />
          </Field>
        </div>

        <h2 className="pt-2 font-serif text-2xl tracking-tight">Reglas de reserva</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Anticipación mínima (minutos)" hint="120 = no se puede reservar con menos de 2 h">
            <input name="minLeadMinutes" type="number" min={0} step={15} defaultValue={s.minLeadMinutes} className={inputClass} />
          </Field>
          <Field label="Cancelar o reprogramar hasta (minutos antes)" hint="180 = hasta 3 h antes">
            <input name="cancelLimitMinutes" type="number" min={0} step={15} defaultValue={s.cancelLimitMinutes} className={inputClass} />
          </Field>
          <Field label="Intervalo entre horarios">
            <select name="slotIntervalMinutes" defaultValue={String(s.slotIntervalMinutes)} className={inputClass}>
              {[5, 10, 15, 20, 30, 60].map((m) => (
                <option key={m} value={m}>
                  {m} minutos
                </option>
              ))}
            </select>
          </Field>
          <Field label="Días hacia adelante para reservar">
            <input name="bookingHorizonDays" type="number" min={1} max={180} defaultValue={s.bookingHorizonDays} className={inputClass} />
          </Field>
        </div>
        <p className="text-xs text-char-mute">
          Zona horaria: {s.timezone} · Moneda: {s.currency}
        </p>
      </ActionForm>
    </Card>
  );
}
