import Link from "next/link";
import { Arrow, btnPrimary, Monogram, textLink } from "@/components/public/ui";
import { formatCop, formatDuration } from "@/lib/format";
import { getCatalog } from "@/server/catalog";

export default async function HomePage() {
  const { business, services, barbers } = await getCatalog();
  const cancelHours = Math.round(business.cancelLimitMinutes / 60);

  return (
    <>
      {/* ---------- Portada ---------- */}
      <section className="grid gap-12 border-b border-rule py-14 sm:py-20 lg:grid-cols-[1.5fr_1fr] lg:items-end lg:gap-16">
        <div>
          <p className="label-caps mb-7 text-oxblood">{business.city}</p>
          <h1 className="font-serif text-[2.75rem] leading-[1.04] font-normal tracking-[-0.02em] text-char sm:text-6xl lg:text-[4.1rem]">
            Oficio de barbero,
            <br />
            <em className="text-oxblood">con cita previa.</em>
          </h1>
          <p className="mt-7 max-w-md text-[1.05rem] leading-relaxed text-char-soft">
            Corte, barba y afeitado a navaja. Escoge el servicio, el barbero y la hora; te confirmamos por WhatsApp.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
            <Link href="/reservar" className={btnPrimary}>
              Reservar cita <Arrow />
            </Link>
            <a href="#servicios" className={`text-sm text-char-soft ${textLink}`}>
              Ver precios
            </a>
          </div>
        </div>

        {/* Ficha del local */}
        <dl className="divide-y divide-rule border-y border-rule text-sm lg:mb-1">
          {business.address && (
            <div className="flex justify-between gap-6 py-3.5">
              <dt className="label-caps pt-0.5 text-char-mute">Dirección</dt>
              <dd className="text-right">{business.address}</dd>
            </div>
          )}
          <div className="flex justify-between gap-6 py-3.5">
            <dt className="label-caps pt-0.5 text-char-mute">Reservas</dt>
            <dd className="text-right">En línea, sin crear cuenta</dd>
          </div>
          <div className="flex justify-between gap-6 py-3.5">
            <dt className="label-caps pt-0.5 text-char-mute">Cambios</dt>
            <dd className="text-right">Hasta {cancelHours} h antes</dd>
          </div>
          <div className="flex justify-between gap-6 py-3.5">
            <dt className="label-caps pt-0.5 text-char-mute">Equipo</dt>
            <dd className="text-right">
              {barbers.length} {barbers.length === 1 ? "barbero" : "barberos"}
            </dd>
          </div>
        </dl>
      </section>

      {/* ---------- Carta de servicios ---------- */}
      <section id="servicios" aria-labelledby="servicios-titulo" className="scroll-mt-20 grid gap-10 border-b border-rule py-16 lg:grid-cols-[1fr_2fr] lg:gap-16">
        <header className="space-y-4">
          <p className="label-caps text-char-mute">Carta</p>
          <h2 id="servicios-titulo" className="font-serif text-4xl leading-tight tracking-tight">
            Servicios
          </h2>
          <p className="max-w-xs text-sm leading-relaxed text-char-mute">
            Precios en pesos colombianos. Toca un servicio para reservarlo.
          </p>
        </header>

        <ol className="divide-y divide-rule/70 border-t border-char">
          {services.map((s, i) => (
            <li key={s.id}>
              <Link href={`/reservar?servicio=${s.id}`} className="group block py-5">
                <div className="flex items-baseline gap-3">
                  <span className="w-6 shrink-0 font-serif text-sm text-char-mute italic tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-serif text-[1.35rem] leading-snug transition-colors group-hover:text-oxblood">{s.name}</span>
                  <span className="leader" aria-hidden />
                  <span className="shrink-0 text-[1.05rem] font-medium tabular-nums">{formatCop(s.priceCop)}</span>
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-4 pl-9 text-sm text-char-mute">
                  <span>{s.description}</span>
                  <span className="shrink-0">{formatDuration(s.durationMin)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- Equipo ---------- */}
      <section aria-labelledby="equipo-titulo" className="py-16">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-4">
            <p className="label-caps text-char-mute">Quiénes atienden</p>
            <h2 id="equipo-titulo" className="font-serif text-4xl leading-tight tracking-tight">
              El equipo
            </h2>
          </div>
          <Link href="/reservar" className={`group inline-flex items-center gap-2.5 text-sm ${textLink}`}>
            Reservar con alguno <Arrow className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </header>

        <ul className="grid border-t border-char sm:grid-cols-3 sm:divide-x sm:divide-rule">
          {barbers.map((b) => (
            <li key={b.id} className="flex gap-4 border-b border-rule py-7 sm:flex-col sm:border-b-0 sm:px-7 sm:first:pl-0 sm:last:pr-0">
              <Monogram name={b.name} photoUrl={b.photoUrl} />
              <div>
                <p className="font-serif text-xl">{b.name}</p>
                {b.bio && <p className="mt-1.5 text-sm leading-relaxed text-char-mute">{b.bio}</p>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
