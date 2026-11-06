import type { Metadata } from "next";
import { StaffShell } from "@/components/staff/staff-shell";

export const metadata: Metadata = { title: { default: "Administración", template: "%s · Admin" }, robots: { index: false } };

const NAV = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/citas", label: "Citas" },
  { href: "/admin/calendario", label: "Calendario" },
  { href: "/admin/servicios", label: "Servicios" },
  { href: "/admin/barberos", label: "Barberos" },
  { href: "/admin/horarios", label: "Horarios y festivos" },
  { href: "/admin/notificaciones", label: "Notificaciones" },
  { href: "/admin/ajustes", label: "Ajustes" },
];

// Cada página verifica el rol con requireAdmin(); el layout no se vuelve a ejecutar al navegar.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <StaffShell title="Administración" nav={NAV}>
      {children}
    </StaffShell>
  );
}
