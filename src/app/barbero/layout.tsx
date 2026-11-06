import type { Metadata } from "next";
import { StaffShell } from "@/components/staff/staff-shell";

export const metadata: Metadata = { title: "Mi agenda", robots: { index: false } };

const NAV = [
  { href: "/barbero", label: "Hoy" },
  { href: "/barbero/semana", label: "Semana" },
  { href: "/barbero/bloqueos", label: "Bloqueos" },
];

// La sesión se verifica en cada página (requireBarber), no aquí: los layouts no se
// vuelven a ejecutar al navegar entre páginas hijas.
export default function BarberLayout({ children }: LayoutProps<"/barbero">) {
  return (
    <StaffShell title="Mi agenda" nav={NAV}>
      {children}
    </StaffShell>
  );
}
