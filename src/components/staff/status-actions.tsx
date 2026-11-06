"use client";

import { useState, useTransition } from "react";
import { setAppointmentStatusAction } from "@/server/actions/barber";

interface Props {
  appointmentId: string;
  status: "CONFIRMED" | "COMPLETED" | "NO_SHOW" | "CANCELLED";
  /** La cita ya empezó: se puede marcar como completada o inasistencia. */
  started: boolean;
}

export function StatusActions({ appointmentId, status, started }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const change = (to: "CONFIRMED" | "COMPLETED" | "NO_SHOW") =>
    startTransition(async () => {
      setError(null);
      const result = await setAppointmentStatusAction(appointmentId, to);
      if (!result.ok) setError(result.error);
    });

  if (status === "CANCELLED") return null;

  const btn =
    "rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "CONFIRMED" && (
          <>
            <button
              type="button"
              disabled={pending || !started}
              onClick={() => change("COMPLETED")}
              className={`${btn} border-emerald-700 text-emerald-300 hover:bg-emerald-950`}
            >
              ✓ Completada
            </button>
            <button
              type="button"
              disabled={pending || !started}
              onClick={() => change("NO_SHOW")}
              className={`${btn} border-amber-800 text-amber-300 hover:bg-amber-950`}
            >
              No asistió
            </button>
            {!started && <span className="self-center text-xs text-ink-500">Disponible cuando empiece la cita</span>}
          </>
        )}
        {(status === "COMPLETED" || status === "NO_SHOW") && (
          <button
            type="button"
            disabled={pending}
            onClick={() => change("CONFIRMED")}
            className={`${btn} border-ink-700 text-ink-300 hover:border-ink-500`}
          >
            Deshacer
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
