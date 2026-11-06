import Link from "next/link";
import { Suspense } from "react";
import { logoutAction } from "@/server/actions/auth";
import { getCurrentUser } from "@/server/auth/dal";
import { NavLinks, StaffNav, type NavItem } from "./staff-nav";

/** Marco de los paneles internos (barbero y admin): barra superior + navegación. */
export function StaffShell({ title, nav, children }: { title: string; nav: NavItem[]; children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-ink-800 bg-ink-950/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link href={nav[0].href} className="font-display text-lg font-semibold">
            {title}
          </Link>
          <div className="flex items-center gap-3">
            <Suspense>
              <UserName />
            </Suspense>
            <form action={logoutAction}>
              <button type="submit" className="rounded-full border border-ink-700 px-3 py-1 text-xs text-ink-300 hover:border-ink-500">
                Salir
              </button>
            </form>
          </div>
        </div>
        <Suspense fallback={<NavLinks items={nav} />}>
          <StaffNav items={nav} />
        </Suspense>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}

async function UserName() {
  const user = await getCurrentUser();
  return user ? <span className="hidden text-sm text-ink-300 sm:inline">{user.name}</span> : null;
}
