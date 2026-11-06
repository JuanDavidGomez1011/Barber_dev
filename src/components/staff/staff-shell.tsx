import Link from "next/link";
import { Suspense } from "react";
import { logoutAction } from "@/server/actions/auth";
import { getCurrentUser } from "@/server/auth/dal";
import { NavLinks, StaffNav, type NavItem } from "./staff-nav";

/** Marco de los paneles internos (barbero y admin): barra superior + navegación. */
export function StaffShell({ title, nav, children }: { title: string; nav: NavItem[]; children: React.ReactNode }) {
  return (
    <div className="theme-paper flex min-h-full flex-1 flex-col">
      <div className="barber-stripe" aria-hidden />
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-5 sm:px-8">
          <Link href={nav[0].href} className="flex items-baseline gap-3">
            <span className="font-serif text-xl tracking-tight">{title}</span>
          </Link>
          <div className="flex items-center gap-5 text-sm">
            <Suspense>
              <UserName />
            </Suspense>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-char-soft underline decoration-rule underline-offset-[5px] transition-colors hover:text-oxblood hover:decoration-oxblood"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
        <Suspense fallback={<NavLinks items={nav} />}>
          <StaffNav items={nav} />
        </Suspense>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-8 sm:py-10">{children}</main>
    </div>
  );
}

async function UserName() {
  const user = await getCurrentUser();
  return user ? <span className="hidden text-char-mute sm:inline">{user.name}</span> : null;
}
