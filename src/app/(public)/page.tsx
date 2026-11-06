import Link from "next/link";
import { formatCop, formatDuration } from "@/lib/format";
import { getCatalog } from "@/server/catalog";

export default async function HomePage() {
  const { business, services, barbers } = await getCatalog();

  return (
    <div className="space-y-12 pt-10">
      <section className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brass-400">{business.city}</p>
        <h1 className="font-display text-4xl leading-tight font-bold sm:text-5xl">
          Tu corte, a la hora que quieras.
        </h1>
        <p className="max-w-md text-ink-300">
          Elige el servicio, tu barbero y el horario. Reservas en menos de un minuto, sin crear cuenta.
        </p>
        <Link
          href="/reservar"
          className="inline-flex items-center rounded-full bg-brass-400 px-6 py-3 font-semibold text-ink-950 transition hover:bg-brass-300"
        >
          Reservar cita
        </Link>
      </section>

      <section aria-labelledby="servicios" className="space-y-4">
        <h2 id="servicios" className="font-display text-2xl font-semibold">
          Servicios
        </h2>
        <ul className="divide-y divide-ink-800 overflow-hidden rounded-2xl border border-ink-800 bg-ink-900">
          {services.map((s) => (
            <li key={s.id}>
              <Link
                href={`/reservar?servicio=${s.id}`}
                className="flex items-center justify-between gap-4 px-4 py-4 transition hover:bg-ink-800/60"
              >
                <div className="min-w-0">
                  <p className="font-medium">{s.name}</p>
                  {s.description && <p className="truncate text-sm text-ink-500">{s.description}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold text-brass-300">{formatCop(s.priceCop)}</p>
                  <p className="text-xs text-ink-500">{formatDuration(s.durationMin)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="equipo" className="space-y-4">
        <h2 id="equipo" className="font-display text-2xl font-semibold">
          Nuestro equipo
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {barbers.map((b) => (
            <li key={b.id} className="rounded-2xl border border-ink-800 bg-ink-900 p-4">
              <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-ink-800 font-display text-lg text-brass-300">
                {b.name.charAt(0)}
              </div>
              <p className="font-medium">{b.name}</p>
              {b.bio && <p className="mt-1 text-sm text-ink-500">{b.bio}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
