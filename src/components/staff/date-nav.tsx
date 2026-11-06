import Link from "next/link";

/** Navegación ← anterior · hoy · siguiente → con enlaces (funciona sin JavaScript). */
export function DateNav({ prevHref, nextHref, todayHref, label, isToday }: {
  prevHref: string;
  nextHref: string;
  todayHref: string;
  label: string;
  isToday: boolean;
}) {
  const btn = "flex size-9 items-center justify-center rounded-full border border-ink-700 hover:border-brass-500";
  return (
    <div className="flex items-center justify-between gap-2">
      <Link href={prevHref} className={btn} aria-label="Anterior">
        ←
      </Link>
      <div className="text-center">
        <p className="font-display text-xl font-semibold">{label}</p>
        {!isToday && (
          <Link href={todayHref} className="text-xs text-brass-300 hover:underline">
            Volver a hoy
          </Link>
        )}
      </div>
      <Link href={nextHref} className={btn} aria-label="Siguiente">
        →
      </Link>
    </div>
  );
}
