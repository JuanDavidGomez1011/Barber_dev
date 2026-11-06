import type { Metadata } from "next";
import { Suspense } from "react";
import { StaffShell } from "@/components/staff/staff-shell";
import { requireAdmin } from "@/server/auth/dal";

export const metadata: Metadata = { title: "Administración", robots: { index: false } };

// Provisional: el panel de administración completo llega en la fase 4.
export default function AdminPage() {
  return (
    <StaffShell title="Administración" nav={[{ href: "/admin", label: "Inicio" }]}>
      <Suspense>
        <Welcome />
      </Suspense>
    </StaffShell>
  );
}

async function Welcome() {
  const user = await requireAdmin();
  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900 p-5">
      <p className="font-display text-xl">Hola, {user.name}</p>
      <p className="mt-1 text-sm text-ink-500">El panel de administración y el dashboard estarán listos en la fase 4.</p>
    </div>
  );
}
