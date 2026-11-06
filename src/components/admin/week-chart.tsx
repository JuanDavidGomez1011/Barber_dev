"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatCop, formatDayChip } from "@/lib/format";

type Day = { date: string; count: number; income: number };

const PLOT_H = 140;
const BAR_W = 24;

/** Redondea el máximo del eje a un número limpio (1, 2, 5, 10, 20…). */
function niceMax(v: number) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

/**
 * Citas por día de la semana (una sola serie: el título dice qué se grafica, sin leyenda).
 * Tooltip al pasar el mouse o enfocar con teclado; valor directo solo en el día de hoy.
 */
export function WeekChart({ days, today }: { days: Day[]; today: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...days.map((d) => d.count), 1));
  const ticks = [0, max / 2, max];

  return (
    <div>
      <div className="relative flex gap-2" style={{ height: PLOT_H + 28 }}>
        {/* Eje Y con líneas guía finas y recesivas */}
        <div className="relative w-6 shrink-0" style={{ height: PLOT_H }}>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2 text-[11px] tabular-nums text-char-mute"
              style={{ top: PLOT_H - (t / max) * PLOT_H }}
            >
              {t}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 h-px bg-paper-deep" style={{ top: PLOT_H - (t / max) * PLOT_H }} />
          ))}
          <div className="absolute inset-x-0 top-0 grid grid-cols-7" style={{ height: PLOT_H }}>
            {days.map((d, i) => {
              const h = (d.count / max) * PLOT_H;
              const chip = formatDayChip(d.date);
              const isToday = d.date === today;
              return (
                <button
                  key={d.date}
                  type="button"
                  aria-label={`${chip.weekday} ${chip.day}: ${d.count} citas, ${formatCop(d.income)}`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  // El área sensible es toda la columna, más grande que la barra.
                  className="relative flex h-full items-end justify-center outline-none"
                >
                  {d.count > 0 && (
                    <span
                      className={cn("block rounded-t-[4px] transition-opacity", hover !== null && hover !== i && "opacity-50")}
                      style={{ width: BAR_W, height: Math.max(h, 2), background: "var(--color-chart-1)" }}
                    />
                  )}
                  {isToday && d.count > 0 && (
                    <span className="absolute text-xs font-semibold text-char" style={{ bottom: h + 4 }}>
                      {d.count}
                    </span>
                  )}
                  {hover === i && (
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute z-10 w-max border border-rule bg-paper px-2.5 py-1.5 text-left text-xs shadow-lg"
                      style={{ bottom: h + 24 }}
                    >
                      <span className="block font-semibold text-char">
                        {chip.weekday} {chip.day} {chip.month}
                      </span>
                      <span className="block text-char-soft">{d.count} citas</span>
                      <span className="block text-char-soft">{formatCop(d.income)}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="absolute inset-x-0 grid grid-cols-7 text-center" style={{ top: PLOT_H + 8 }}>
            {days.map((d) => (
              <span key={d.date} className={cn("text-xs", d.date === today ? "font-semibold text-char" : "text-char-mute")}>
                {formatDayChip(d.date).weekday}
              </span>
            ))}
          </div>
        </div>
      </div>

      <details className="mt-2 text-xs text-char-mute">
        <summary className="cursor-pointer">Ver como tabla</summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead>
            <tr className="text-char-mute">
              <th className="py-1 font-medium">Día</th>
              <th className="py-1 text-right font-medium">Citas</th>
              <th className="py-1 text-right font-medium">Ingresos est.</th>
            </tr>
          </thead>
          <tbody className="text-char-soft">
            {days.map((d) => {
              const c = formatDayChip(d.date);
              return (
                <tr key={d.date} className="border-t border-rule">
                  <td className="py-1">
                    {c.weekday} {c.day} {c.month}
                  </td>
                  <td className="py-1 text-right">{d.count}</td>
                  <td className="py-1 text-right">{formatCop(d.income)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </div>
  );
}
