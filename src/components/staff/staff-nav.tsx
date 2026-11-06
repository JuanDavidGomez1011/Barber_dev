"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export type NavItem = { href: string; label: string };

/** Enlaces de navegación; `active` es la ruta resaltada (si se conoce). */
export function NavLinks({ items, active }: { items: NavItem[]; active?: string }) {
  return (
    <nav className="no-scrollbar mx-auto flex max-w-5xl gap-6 overflow-x-auto px-5 sm:px-8">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.href === active ? "page" : undefined}
          className={cn(
            "label-caps -mb-px shrink-0 border-b-2 pt-1 pb-3 transition-colors",
            item.href === active ? "border-char text-char" : "border-transparent text-char-mute hover:text-char",
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
