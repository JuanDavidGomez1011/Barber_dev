"use client";

import { useActionState, useState } from "react";
import { cn } from "@/lib/cn";
import { setWorkingHoursAction } from "@/server/actions/admin";
import { buttonClass } from "./ui";

type Shift = { key: number; dayOfWeek: number; start: string; end: string };

// Lunes primero, como se lee una semana de trabajo.
const DAYS = [
  [1, "Lunes"],
  [2, "Martes"],
  [3, "Miércoles"],
  [4, "Jueves"],
  [5, "Viernes"],
  [6, "Sábado"],
  [0, "Domingo"],
] as const;

const timeInput =
  "w-28 rounded-lg border border-ink-800 bg-ink-950 px-2 py-1.5 text-sm outline-none focus:border-brass-400 [color-scheme:dark]";

/** Editor de turnos semanales: varios turnos por día (turno partido), copiar a otros días. */
export function WorkingHoursEditor({ barberId, initial }: { barberId: string; initial: Omit<Shift, "key">[] }) {
  const [shifts, setShifts] = useState<Shift[]>(() => initial.map((s, i) => ({ ...s, key: i })));
  const [nextKey, setNextKey] = useState(initial.length);
  const [state, formAction, pending] = useActionState(setWorkingHoursAction, undefined);

  const add = (dayOfWeek: number, start = "09:00", end = "18:00") => {
    setShifts((s) => [...s, { key: nextKey, dayOfWeek, start, end }]);
    setNextKey((k) => k + 1);
  };
  const update = (key: number, patch: Partial<Shift>) => setShifts((s) => s.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const remove = (key: number) => setShifts((s) => s.filter((x) => x.key !== key));

  /** Copia los turnos del lunes al resto de días laborales (martes a sábado). */
  const copyMonday = () => {
    const monday = shifts.filter((s) => s.dayOfWeek === 1);
    let k = nextKey;
    const copies = [2, 3, 4, 5, 6].flatMap((d) => monday.map((m) => ({ ...m, dayOfWeek: d, key: k++ })));
    setShifts((s) => [...s.filter((x) => x.dayOfWeek === 0 || x.dayOfWeek === 1), ...copies]);
    setNextKey(k);
  };

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={barberId} />
      <input
        type="hidden"
        name="shifts"
        value={JSON.stringify(shifts.map(({ dayOfWeek, start, end }) => ({ dayOfWeek, start, end })))}
      />

      <ul className="divide-y divide-ink-800 rounded-xl border border-ink-800">
        {DAYS.map(([dow, label]) => {
          const day = shifts.filter((s) => s.dayOfWeek === dow).sort((a, b) => a.start.localeCompare(b.start));
          return (
            <li key={dow} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <span className={cn("w-24 text-sm font-medium", day.length === 0 && "text-ink-500")}>{label}</span>
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {day.length === 0 && <span className="text-sm text-ink-500">No trabaja</span>}
                {day.map((s) => (
                  <span key={s.key} className="inline-flex items-center gap-1.5">
                    <input type="time" step={900} value={s.start} onChange={(e) => update(s.key, { start: e.target.value })} className={timeInput} aria-label={`${label}: inicio`} />
                    <span className="text-ink-500">–</span>
                    <input type="time" step={900} value={s.end} onChange={(e) => update(s.key, { end: e.target.value })} className={timeInput} aria-label={`${label}: fin`} />
                    <button type="button" onClick={() => remove(s.key)} className="px-1 text-ink-500 hover:text-red-300" aria-label="Quitar turno">
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  const last = day.at(-1);
                  // Un segundo turno el mismo día empieza una hora después del primero (turno partido).
                  if (last) add(dow, addHour(last.end), addHour(addHour(last.end), 3));
                  else add(dow);
                }}
                className="text-xs text-brass-300 hover:underline"
              >
                + turno
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Guardando…" : "Guardar horario"}
        </button>
        <button type="button" onClick={copyMonday} className={buttonClass.secondary}>
          Copiar lunes a martes–sábado
        </button>
        {state && (
          <p role={state.ok ? "status" : "alert"} className={cn("text-sm", state.ok ? "text-emerald-300" : "text-red-300")}>
            {state.ok ? state.message : state.error}
          </p>
        )}
      </div>
    </form>
  );
}

function addHour(hhmm: string, hours = 1) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min(h * 60 + m + hours * 60, 23 * 60 + 45);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
