import Link from "next/link";

/** Navegación ← anterior · hoy · siguiente → con enlaces (funciona sin JavaScript). */
export function DateNav({ prevHref, nextHref, todayHref, label, isToday }: {
  prevHref: string;
  nextHref: string;
  todayHref: string;
  label: string;
  isToday: boolean;
}) {
  const btn = "flex size-9 items-center justify-center border border-rule transition-colors hover:border-char hover:bg-char hover:text-paper-light";
  return (
    <div className="flex items-center justify-between gap-2">
      <Link href={prevHref} className={btn} aria-label="Anterior">
        ←
      </Link>
      <div className="text-center">
        <p className="font-serif text-2xl tracking-tight">{label}</p>
        {!isToday && (
          <Link href={todayHref} className="text-xs text-oxblood hover:underline">
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
