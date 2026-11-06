"use client";

import { useState, useTransition } from "react";
import { adminCancelAction, adminSetStatusAction } from "@/server/actions/admin";
import { buttonClass } from "./ui";

type Status = "CONFIRMED" | "COMPLETED" | "NO_SHOW" | "CANCELLED";

/** Acciones del admin sobre una cita: cambiar estado o cancelar (con motivo). */
export function AppointmentRowActions({ id, status, started }: { id: string; status: Status; started: boolean }) {
  const [mode, setMode] = useState<"idle" | "cancel">("idle");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => ReturnType<typeof adminCancelAction>) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (res && !res.ok) setError(res.error ?? "Error");
      else setMode("idle");
    });

  if (status === "CANCELLED") return null;
  const small = "px-3 py-1 text-xs";

  if (mode === "cancel") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={120}
          placeholder="Motivo (opcional)"
          className=" border border-rule bg-paper px-2 py-1 text-xs outline-none focus:border-char"
        />
        <button type="button" disabled={pending} onClick={() => run(() => adminCancelAction(id, reason))} className={`${buttonClass.danger} ${small}`}>
          {pending ? "…" : "Cancelar cita"}
        </button>
        <button type="button" disabled={pending} onClick={() => setMode("idle")} className={`${buttonClass.secondary} ${small}`}>
          Volver
        </button>
        {error && <span className="text-xs text-oxblood">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "CONFIRMED" && started && (
        <>
          <button type="button" disabled={pending} onClick={() => run(() => adminSetStatusAction(id, "COMPLETED"))} className={`${buttonClass.secondary} ${small}`}>
            ✓ Completada
          </button>
          <button type="button" disabled={pending} onClick={() => run(() => adminSetStatusAction(id, "NO_SHOW"))} className={`${buttonClass.secondary} ${small}`}>
            No asistió
          </button>
        </>
      )}
      {status === "CONFIRMED" && (
        <button type="button" onClick={() => setMode("cancel")} className={`${buttonClass.danger} ${small}`}>
          Cancelar
        </button>
      )}
      {(status === "COMPLETED" || status === "NO_SHOW") && (
        <button type="button" disabled={pending} onClick={() => run(() => adminSetStatusAction(id, "CONFIRMED"))} className={`${buttonClass.secondary} ${small}`}>
          Deshacer
        </button>
      )}
      {error && <span className="text-xs text-oxblood">{error}</span>}
    </div>
  );
}
