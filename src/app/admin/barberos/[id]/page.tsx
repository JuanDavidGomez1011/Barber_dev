import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { BarberFields } from "@/components/admin/barber-fields";
import { Card, Field, inputClass, PageTitle, Skeleton } from "@/components/admin/ui";
import { WorkingHoursEditor } from "@/components/admin/working-hours-editor";
import { formatMinute } from "@/lib/time";
import { setBarberPasswordAction, updateBarberAction } from "@/server/actions/admin";
import { requireAdmin } from "@/server/auth/dal";
import { futureConfirmedCount, getBarber, listServices } from "@/server/services/admin.service";

export const metadata: Metadata = { title: "Editar barbero" };

export default function EditBarberPage({ params, searchParams }: PageProps<"/admin/barberos/[id]">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/barberos" className="text-sm text-char-mute hover:text-char">
        ← Barberos
      </Link>
      <Suspense fallback={<Skeleton className="mt-4 h-[40rem]" />}>
        <EditBarber params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function EditBarber({ params, searchParams }: PageProps<"/admin/barberos/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const { nuevo } = await searchParams;
  const [barber, services, pending] = await Promise.all([getBarber(id), listServices(), futureConfirmedCount(id)]);
  if (!barber) notFound();

  return (
    <div className="space-y-5">
      <PageTitle title={barber.name} description={`${pending} citas confirmadas próximas`} />

      {nuevo === "1" && (
        <p className=" border border-moss/40 bg-moss/10 p-3 text-sm text-moss">
          Barbero creado. Ahora define sus horarios de trabajo: sin horario no aparece en las reservas.
        </p>
      )}

      <Card>
        <h2 className="mb-1 font-serif text-2xl tracking-tight">Horario semanal</h2>
        <p className="mb-4 text-sm text-char-mute">
          Agrega un segundo turno el mismo día para un turno partido (ej: 9:00–13:00 y 14:00–19:00). El horario del local
          también limita las reservas.
        </p>
        <WorkingHoursEditor
          barberId={barber.id}
          initial={barber.workingHours.map((w) => ({ dayOfWeek: w.dayOfWeek, start: formatMinute(w.startMinute), end: formatMinute(w.endMinute) }))}
        />
      </Card>

      <Card>
        <h2 className="mb-4 font-serif text-2xl tracking-tight">Datos</h2>
        <ActionForm action={updateBarberAction}>
          <BarberFields
            b={{
              id: barber.id,
              name: barber.name,
              bio: barber.bio,
              photoUrl: barber.photoUrl,
              email: barber.user?.email ?? "",
              sortOrder: barber.sortOrder,
              active: barber.active,
              serviceIds: barber.services.map((s) => s.serviceId),
            }}
            services={services}
          />
        </ActionForm>
      </Card>

      {barber.user && (
        <Card>
          <h2 className="mb-4 font-serif text-2xl tracking-tight">Cambiar contraseña</h2>
          <ActionForm action={setBarberPasswordAction} submitLabel="Cambiar contraseña" resetOnSuccess>
            <input type="hidden" name="id" value={barber.id} />
            <Field label="Nueva contraseña" hint="Mínimo 8 caracteres" className="max-w-sm">
              <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
            </Field>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
