"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { formatLongDate, formatTime } from "@/lib/format";
import { cancelBookingAction, rescheduleBookingAction } from "@/server/actions/booking";
import { SlotPicker, type Slot } from "./slot-picker";

interface Props {
  token: string;
  canModify: boolean;
  deadline: string;
  serviceId: string;
  currentBarberId: string;
  barbers: { id: string; name: string }[];
  whatsapp: string | null;
  cancelLimitHours: number;
}

type Mode = "idle" | "confirm-cancel" | "reschedule";

export function AppointmentActions(props: Props) {
  const { token, canModify, deadline, serviceId, currentBarberId, barbers, whatsapp, cancelLimitHours } = props;
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [barberId, setBarberId] = useState<string | null>(currentBarberId);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const whatsappUrl = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, "")}` : null;

  if (!canModify) {
    return (
      <p className="rounded-2xl border border-ink-800 bg-ink-900 p-4 text-sm text-ink-300">
        Las citas se pueden cancelar o reprogramar hasta {cancelLimitHours} horas antes.
        {whatsappUrl && (
          <>
            {" "}
            Si necesitas un cambio,{" "}
            <a href={whatsappUrl} className="text-brass-300 underline underline-offset-4">
              escríbenos por WhatsApp
            </a>
            .
          </>
        )}
      </p>
    );
  }

  function cancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelBookingAction(token);
      if (!result.ok) return setError(result.error);
      setMode("idle");
      router.refresh();
    });
  }

  function reschedule() {
    if (!slot) return;
    setError(null);
    startTransition(async () => {
      const result = await rescheduleBookingAction({ token, barberId: barberId ?? "any", startsAt: slot.startsAt });
      if (!result.ok) {
        setError(result.error);
        if (result.code === "SLOT_TAKEN") {
          setSlot(null);
          setReloadKey((k) => k + 1);
        }
        return;
      }
      setMessage(`Listo, tu cita quedó para el ${formatLongDate(slot.startsAt).toLowerCase()} a las ${formatTime(slot.startsAt)}`);
      setMode("idle");
      setSlot(null);
      router.refresh();
    });
  }

  return (
    <section className="space-y-4">
      {message && (
        <p role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-3 text-sm text-emerald-200">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {mode === "idle" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setMessage(null);
                setMode("reschedule");
              }}
              className="rounded-full bg-brass-400 py-3 font-semibold text-ink-950 transition hover:bg-brass-300"
            >
              Reprogramar
            </button>
            <button
              type="button"
              onClick={() => {
                setMessage(null);
                setMode("confirm-cancel");
              }}
              className="rounded-full border border-ink-700 py-3 font-semibold text-ink-300 transition hover:border-red-700 hover:text-red-300"
            >
              Cancelar cita
            </button>
          </div>
          <p className="text-center text-xs text-ink-500">
            Puedes hacer cambios hasta el {formatLongDate(deadline).toLowerCase()} a las {formatTime(deadline)}
          </p>
        </div>
      )}

      {mode === "confirm-cancel" && (
        <div className="space-y-3 rounded-2xl border border-red-900/60 bg-red-950/30 p-4">
          <p className="font-medium">¿Seguro que quieres cancelar tu cita?</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={cancel}
              className="rounded-full bg-red-600 py-2.5 font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
            >
              {pending ? "Cancelando…" : "Sí, cancelar"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setMode("idle")}
              className="rounded-full border border-ink-700 py-2.5 font-semibold transition hover:border-ink-500"
            >
              No, mantener
            </button>
          </div>
        </div>
      )}

      {mode === "reschedule" && (
        <div className="space-y-5 rounded-2xl border border-ink-800 bg-ink-900 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Nuevo horario</h2>
            <button type="button" onClick={() => setMode("idle")} className="text-sm text-ink-300 hover:text-ink-100">
              Cerrar
            </button>
          </div>

          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {[...barbers, { id: null, name: "Cualquiera" }].map((b) => (
              <button
                key={b.id ?? "any"}
                type="button"
                onClick={() => {
                  setBarberId(b.id);
                  setSlot(null);
                }}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-1.5 text-sm transition",
                  barberId === b.id ? "border-brass-400 bg-brass-400 text-ink-950" : "border-ink-700 hover:border-brass-500",
                )}
              >
                {b.name}
              </button>
            ))}
          </div>

          <SlotPicker
            serviceId={serviceId}
            barberId={barberId}
            token={token}
            selected={slot}
            onSelect={setSlot}
            reloadKey={reloadKey}
          />

          <button
            type="button"
            disabled={!slot || pending}
            onClick={reschedule}
            className="w-full rounded-full bg-brass-400 py-3 font-semibold text-ink-950 transition hover:bg-brass-300 disabled:cursor-not-allowed disabled:bg-ink-800 disabled:text-ink-500"
          >
            {pending ? "Guardando…" : slot ? `Cambiar a ${formatTime(slot.startsAt)}` : "Elige un horario"}
          </button>
        </div>
      )}
    </section>
  );
}
