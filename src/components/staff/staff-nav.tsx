"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export type NavItem = { href: string; label: string };

/** Enlaces de navegación; `active` es la ruta resaltada (si se conoce). */
export function NavLinks({ items, active }: { items: NavItem[]; active?: string }) {
  return (
    <nav className="no-scrollbar mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-sm transition",
            item.href === active ? "bg-ink-800 font-medium text-ink-100" : "text-ink-500 hover:text-ink-100",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** Lee la URL actual: en rutas dinámicas debe ir dentro de <Suspense> (fallback: NavLinks sin resaltar). */
export function StaffNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  // La ruta más específica que coincide es la activa (/barbero no se marca en /barbero/semana).
  const active = [...items]
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))?.href;
  return <NavLinks items={items} active={active} />;
}
