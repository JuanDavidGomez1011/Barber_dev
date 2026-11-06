"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { formatLongDate, formatTime } from "@/lib/format";
import { cancelBookingAction, rescheduleBookingAction } from "@/server/actions/booking";
import { Arrow, btnPrimary, btnSecondary, Notice, textLink } from "../public/ui";
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
      <Notice tone="info">
        Las citas se pueden cancelar o cambiar hasta {cancelLimitHours} horas antes.
        {whatsappUrl && (
          <>
            {" "}
            Si necesitas un cambio,{" "}
            <a href={whatsappUrl} className={textLink}>
              escríbenos por WhatsApp
            </a>
            .
          </>
        )}
      </Notice>
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
      {message && <Notice tone="success">{message}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      {mode === "idle" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setMessage(null);
                setMode("reschedule");
              }}
              className={btnPrimary}
            >
              Cambiar hora
            </button>
            <button
              type="button"
              onClick={() => {
                setMessage(null);
                setMode("confirm-cancel");
              }}
              className={cn(btnSecondary, "hover:border-oxblood hover:bg-oxblood")}
            >
              Cancelar cita
            </button>
          </div>
          <p className="text-center text-xs text-char-mute">
            Puedes hacer cambios hasta el {formatLongDate(deadline).toLowerCase()} a las {formatTime(deadline)}
          </p>
        </div>
      )}

      {mode === "confirm-cancel" && (
        <div className="space-y-4 border border-oxblood/60 bg-oxblood/[0.05] p-5">
          <div className="space-y-1">
            <p className="font-serif text-xl">¿Cancelar tu cita?</p>
            <p className="text-sm text-char-mute">El horario queda libre para otra persona.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" disabled={pending} onClick={cancel} className={cn(btnPrimary, "bg-oxblood hover:bg-oxblood-deep")}>
              {pending ? "Cancelando…" : "Sí, cancelar"}
            </button>
            <button type="button" disabled={pending} onClick={() => setMode("idle")} className={btnSecondary}>
              No, mantener
            </button>
          </div>
        </div>
      )}

      {mode === "reschedule" && (
        <div className="space-y-6 border-t border-char pt-6">
          <div className="flex items-end justify-between">
            <h2 className="font-serif text-[1.9rem] leading-tight tracking-tight">Nueva hora</h2>
            <button type="button" onClick={() => setMode("idle")} className={`mb-1 text-sm text-char-soft ${textLink}`}>
              Cerrar
            </button>
          </div>

          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:px-0">
            {[...barbers, { id: null, name: "Cualquiera" }].map((b) => (
              <button
                key={b.id ?? "any"}
                type="button"
                onClick={() => {
                  setBarberId(b.id);
                  setSlot(null);
                }}
                className={cn(
                  "shrink-0 border px-4 py-2 text-sm transition-colors",
                  barberId === b.id ? "border-char bg-char text-paper-light" : "border-rule bg-paper-light/50 hover:border-char",
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

          <button type="button" disabled={!slot || pending} onClick={reschedule} className={cn(btnPrimary, "w-full")}>
            {pending ? (
              "Guardando…"
            ) : slot ? (
              <>
                Cambiar a las {formatTime(slot.startsAt)} <Arrow />
              </>
            ) : (
              "Elige un horario"
            )}
          </button>
        </div>
      )}
    </section>
  );
}
