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
    "border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "CONFIRMED" && (
          <>
            <button
              type="button"
              disabled={pending || !started}
              onClick={() => change("COMPLETED")}
              className={`${btn} border-moss/40 text-moss hover:bg-moss/10`}
            >
              ✓ Completada
            </button>
            <button
              type="button"
              disabled={pending || !started}
              onClick={() => change("NO_SHOW")}
              className={`${btn} border-amber-700/40 text-amber-800 hover:bg-amber-100`}
            >
              No asistió
            </button>
            {!started && <span className="self-center text-xs text-char-mute">Disponible cuando empiece la cita</span>}
          </>
        )}
        {(status === "COMPLETED" || status === "NO_SHOW") && (
          <button
            type="button"
            disabled={pending}
            onClick={() => change("CONFIRMED")}
            className={`${btn} border-rule text-char-soft hover:border-char-mute`}
          >
            Deshacer
          </button>
        )}
      </div>
      {error && <p className="text-xs text-oxblood">{error}</p>}
    </div>
  );
}
