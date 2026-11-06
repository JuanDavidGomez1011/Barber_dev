import Link from "next/link";
import { getCatalog } from "@/server/catalog";

export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const { business } = await getCatalog();

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-ink-800/80 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="font-display text-lg font-semibold tracking-wide text-ink-100">
            {business.name}
          </Link>
          <Link
            href="/reservar"
            className="rounded-full bg-brass-400 px-4 py-1.5 text-sm font-semibold text-ink-950 transition hover:bg-brass-300"
          >
            Reservar
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">{children}</main>

      <footer className="border-t border-ink-800 py-6 text-center text-xs text-ink-500">
        <p>
          {business.name} · {business.city}
          {business.address ? ` · ${business.address}` : ""}
        </p>
        <p className="mt-2">
          <Link href="/login" className="text-ink-500 underline-offset-4 transition hover:text-ink-300 hover:underline">
            Acceso del equipo
          </Link>
        </p>
      </footer>
    </>
  );
}
