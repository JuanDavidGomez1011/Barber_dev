"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { formatDayChip, formatLongDate, formatTime } from "@/lib/format";
import { Notice } from "../public/ui";
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
      <div className="space-y-5" aria-busy="true">
        <div className="flex gap-px overflow-hidden border border-rule bg-rule">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="h-[4.5rem] w-16 shrink-0 animate-pulse bg-paper-deep/60" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="h-11 animate-pulse bg-paper-deep/60" />
          ))}
        </div>
        <p className="sr-only">Cargando horarios…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return <Notice tone="error">{state.message}</Notice>;
  }

  if (!firstAvailable) {
    return (
      <Notice tone="info">
        No hay horarios libres en los próximos días. Prueba con otro barbero o escríbenos por WhatsApp.
      </Notice>
    );
  }

  return (
    <div className="space-y-7">
      {/* Días: tira continua, como las hojas de una agenda */}
      <div
        className="no-scrollbar -mx-5 flex snap-x scroll-px-5 overflow-x-auto px-5 sm:mx-0 sm:scroll-px-0 sm:px-0"
        role="listbox"
        aria-label="Día"
      >
        <div className="flex border-y border-l border-rule">
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
                  "flex w-16 shrink-0 snap-start flex-col items-center border-r border-rule py-2.5 transition-colors",
                  active ? "bg-char text-paper-light" : "bg-paper-light/40 text-char hover:bg-paper-deep/60",
                  disabled && "cursor-not-allowed text-char-mute/40 hover:bg-paper-light/40",
                )}
              >
                <span className="label-caps !text-[0.62rem] opacity-80">{chip.weekday}</span>
                <span className="mt-1 font-serif text-2xl leading-none tabular-nums">{chip.day}</span>
                <span className="mt-1 text-[0.7rem] opacity-70">{chip.month}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeDay && (
        <div className="space-y-6">
          <p className="font-serif text-lg italic text-char-soft">{formatLongDate(activeDay.slots[0].startsAt)}</p>
          {grouped.map((group) => (
            <div key={group.label} className="space-y-3">
              <p className="label-caps flex items-center gap-3 text-char-mute">
                {group.label}
                <span className="h-px flex-1 bg-rule/70" aria-hidden />
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {group.slots.map((slot) => {
                  const isSelected = selected?.startsAt === slot.startsAt;
                  return (
                    <button
                      key={slot.startsAt}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onSelect(slot)}
                      className={cn(
                        "h-11 border text-sm tabular-nums transition-colors",
                        isSelected
                          ? "border-char bg-char text-paper-light"
                          : "border-rule bg-paper-light/50 text-char hover:border-char",
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
