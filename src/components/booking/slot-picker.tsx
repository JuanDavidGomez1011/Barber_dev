"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { formatDayChip, formatLongDate, formatTime } from "@/lib/format";
import type { AvailabilityResult, Slot } from "@/server/services/availability.service";

export type { Slot };

interface Props {
  serviceId: string;
  /** null = cualquier barbero disponible */
  barberId: string | null;
  /** Al reprogramar: token de la cita, para que su propio horario no cuente como ocupado. */
  token?: string;
  selected: Slot | null;
  onSelect: (slot: Slot) => void;
  /** Cambiarlo fuerza a recargar los horarios (p. ej. si alguien tomó el horario elegido). */
  reloadKey?: number;
}

const PERIODS = [
  { label: "Mañana", from: 0, to: 12 * 60 },
  { label: "Tarde", from: 12 * 60, to: 18 * 60 },
  { label: "Noche", from: 18 * 60, to: 24 * 60 },
];

type Loaded =
  | { key: string; status: "error"; message: string }
  | { key: string; status: "ready"; data: AvailabilityResult };
type State = { status: "loading" } | Loaded;

export function SlotPicker({ serviceId, barberId, token, selected, onSelect, reloadKey = 0 }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [pickedDate, setPickedDate] = useState<string | null>(null);

  // Identifica la consulta actual: si lo cargado es de otra consulta, se muestra "cargando".
  const requestKey = `${serviceId}|${barberId ?? "any"}|${token ?? ""}|${reloadKey}`;
  const state: State = loaded?.key === requestKey ? loaded : { status: "loading" };

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ serviceId, barberId: barberId ?? "any" });
    if (token) params.set("token", token);

    fetch(`/api/availability?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "No pudimos cargar los horarios.");
        setLoaded({ key: requestKey, status: "ready", data: body as AvailabilityResult });
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") setLoaded({ key: requestKey, status: "error", message: err.message });
      });
    return () => controller.abort();
  }, [requestKey, serviceId, barberId, token]);

  const days = state.status === "ready" ? state.data.days : [];
  const firstAvailable = days.find((d) => d.slots.length > 0)?.date ?? null;
  // Si el día elegido ya no tiene horarios (o no hay ninguno elegido), se usa el primero con cupo.
  const activeDate =
    pickedDate && days.some((d) => d.date === pickedDate && d.slots.length > 0) ? pickedDate : firstAvailable;
  const activeDay = days.find((d) => d.date === activeDate);

  const grouped = useMemo(
    () =>
      PERIODS.map((p) => ({
        ...p,
        slots: activeDay?.slots.filter((s) => s.minute >= p.from && s.minute < p.to) ?? [],
      })).filter((p) => p.slots.length > 0),
    [activeDay],
  );

  if (state.status === "loading") {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-16 w-14 shrink-0 animate-pulse rounded-xl bg-ink-800" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-ink-800" />
          ))}
        </div>
        <p className="sr-only">Cargando horarios…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return <p className="rounded-xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">{state.message}</p>;
  }

  if (!firstAvailable) {
    return (
      <p className="rounded-xl border border-ink-800 bg-ink-900 p-4 text-sm text-ink-300">
        No hay horarios disponibles en los próximos días. Prueba con otro barbero o escríbenos por WhatsApp.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1" role="listbox" aria-label="Día">
        {days.map((d) => {
          const chip = formatDayChip(d.date);
          const disabled = d.slots.length === 0;
          const active = d.date === activeDate;
          return (
            <button
              key={d.date}
              type="button"
              role="option"
              aria-selected={active}
              disabled={disabled}
              onClick={() => setPickedDate(d.date)}
              className={cn(
                "flex w-14 shrink-0 snap-start flex-col items-center rounded-xl border py-2 text-xs transition",
                active
                  ? "border-brass-400 bg-brass-400 text-ink-950"
                  : "border-ink-800 bg-ink-900 text-ink-300 hover:border-ink-700",
                disabled && "cursor-not-allowed opacity-35 hover:border-ink-800",
              )}
            >
              <span className="font-medium">{chip.weekday}</span>
              <span className="text-lg leading-tight font-semibold">{chip.day}</span>
              <span className="capitalize">{chip.month}</span>
            </button>
          );
        })}
      </div>

      {activeDay && (
        <div className="space-y-4">
          <p className="text-sm text-ink-300">{formatLongDate(activeDay.slots[0].startsAt)}</p>
          {grouped.map((group) => (
            <div key={group.label} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">{group.label}</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {group.slots.map((slot) => {
                  const isSelected = selected?.startsAt === slot.startsAt;
                  return (
                    <button
                      key={slot.startsAt}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onSelect(slot)}
                      className={cn(
                        "h-11 rounded-lg border text-sm font-medium transition",
                        isSelected
                          ? "border-brass-400 bg-brass-400 text-ink-950"
                          : "border-ink-800 bg-ink-900 hover:border-brass-500 hover:text-brass-300",
                      )}
                    >
                      {formatTime(slot.startsAt)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
