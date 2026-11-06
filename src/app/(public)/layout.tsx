import Link from "next/link";
import { Arrow } from "@/components/public/ui";
import { getCatalog } from "@/server/catalog";

export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const { business } = await getCatalog();
  const whatsappUrl = business.whatsapp ? `https://wa.me/${business.whatsapp.replace(/\D/g, "")}` : null;

  return (
    <div className="theme-paper flex min-h-full flex-1 flex-col">
      <div className="barber-stripe" aria-hidden />
      <header className="sticky top-0 z-20 border-b border-rule/70 bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="font-serif text-xl font-medium tracking-tight text-char sm:text-[1.4rem]">
            {business.name}
          </Link>
          <Link
            href="/reservar"
            className="group inline-flex items-center gap-2.5 text-sm font-medium text-char transition-colors hover:text-oxblood"
          >
            <span className="label-caps !text-[0.78rem]">Reservar</span>
            <Arrow className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-20 sm:px-8">{children}</main>

      <footer className="bg-char text-paper-deep">
        <div className="mx-auto grid max-w-5xl gap-8 px-5 py-12 sm:grid-cols-[1.4fr_1fr_1fr] sm:px-8">
          <div className="space-y-2">
            <p className="font-serif text-2xl text-paper-light">{business.name}</p>
            <p className="text-sm text-paper-deep/70">Corte, barba y afeitado con cita previa.</p>
          </div>
          <div className="space-y-3 text-sm">
            <p className="label-caps text-paper-deep/60">Dónde</p>
            <p className="leading-relaxed">
              {business.address && (
                <>
                  {business.address}
                  <br />
                </>
              )}
              {business.city}
            </p>
          </div>
          <div className="space-y-3 text-sm">
            <p className="label-caps text-paper-deep/60">Contacto</p>
            {whatsappUrl ? (
              <a href={whatsappUrl} className="block underline decoration-paper-deep/30 underline-offset-4 hover:decoration-paper-light">
                WhatsApp
              </a>
            ) : (
              <p className="text-paper-deep/70">Escríbenos en el local</p>
            )}
            <Link href="/reservar" className="block underline decoration-paper-deep/30 underline-offset-4 hover:decoration-paper-light">
              Reservar en línea
            </Link>
          </div>
        </div>
        <div className="border-t border-paper-deep/10">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 text-xs text-paper-deep/50 sm:px-8">
            <p>© {business.name}</p>
            <Link href="/login" className="transition-colors hover:text-paper-deep">
              Acceso del equipo
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
