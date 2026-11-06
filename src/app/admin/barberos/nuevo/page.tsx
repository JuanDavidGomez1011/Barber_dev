import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { BarberFields } from "@/components/admin/barber-fields";
import { Card, PageTitle, Skeleton } from "@/components/admin/ui";
import { createBarberAction } from "@/server/actions/admin";
import { requireAdmin } from "@/server/auth/dal";
import { listServices } from "@/server/services/admin.service";

export const metadata: Metadata = { title: "Nuevo barbero" };

export default function NewBarberPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/barberos" className="text-sm text-ink-500 hover:text-ink-100">
        ← Barberos
      </Link>
      <PageTitle title="Nuevo barbero" description="Después de crearlo podrás definir sus horarios de trabajo." />
      <Suspense fallback={<Skeleton />}>
        <NewBarberForm />
      </Suspense>
    </div>
  );
}

async function NewBarberForm() {
  await requireAdmin();
  const services = await listServices();
  return (
    <Card>
      <ActionForm action={createBarberAction} submitLabel="Crear barbero">
        <BarberFields b={{}} services={services} withPassword />
      </ActionForm>
    </Card>
  );
}
