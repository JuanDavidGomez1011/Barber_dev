"use client";

import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { formatCop, formatDuration, formatLongDate, formatTime } from "@/lib/format";
import { customerSchema } from "@/lib/validation/booking";
import { createBookingAction } from "@/server/actions/booking";
import type { PublicBarber, PublicService } from "@/server/catalog";
import { SlotPicker, type Slot } from "./slot-picker";

interface Props {
  services: PublicService[];
  barbers: PublicBarber[];
}

type Step = 1 | 2 | 3 | 4;
const STEP_TITLES: Record<Step, string> = {
  1: "Elige el servicio",
  2: "Elige tu barbero",
  3: "Elige fecha y hora",
  4: "Tus datos",
};

type FieldErrors = Partial<Record<"name" | "phone" | "note", string>>;

export function BookingWizard({ services, barbers }: Props) {
  const searchParams = useSearchParams();
  const preselected = services.find((s) => s.id === searchParams.get("servicio")) ?? null;

  const [step, setStep] = useState<Step>(preselected ? 2 : 1);
  const [serviceId, setServiceId] = useState<string | null>(preselected?.id ?? null);
  /** undefined = aún no elige; null = cualquiera disponible */
  const [barberId, setBarberId] = useState<string | null | undefined>(undefined);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState({ name: "", phone: "", note: "", website: "" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const service = services.find((s) => s.id === serviceId) ?? null;
  const availableBarbers = service ? barbers.filter((b) => b.serviceIds.includes(service.id)) : [];
  const barber = barberId ? barbers.find((b) => b.id === barberId) : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!service || !slot || barberId === undefined) return;

    const parsed = customerSchema.safeParse(form);
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        errors[key] ??= issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setFormError(null);

    startTransition(async () => {
      // Si todo sale bien, la acción redirige a la página de la cita.
      const result = await createBookingAction({
        serviceId: service.id,
        barberId: barberId ?? "any",
        startsAt: slot.startsAt,
        name: form.name,
        phone: form.phone,
        note: form.note,
        website: form.website,
      });
      if (result.ok) return;
      setFormError(result.error);
      if (result.code === "SLOT_TAKEN") {
        setSlot(null);
        setReloadKey((k) => k + 1);
        setStep(3);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Progreso */}
      <div className="space-y-3">
        <div className="flex gap-1.5" aria-hidden>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className={cn("h-1 flex-1 rounded-full", n <= step ? "bg-brass-400" : "bg-ink-800")} />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold">{STEP_TITLES[step]}</h1>
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as Step)}
              className="text-sm text-ink-300 underline-offset-4 hover:text-ink-100 hover:underline"
            >
              ← Atrás
            </button>
          )}
        </div>
        <p className="text-xs text-ink-500">Paso {step} de 4</p>
      </div>

      {/* Resumen de lo elegido */}
      {step > 1 && service && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl border border-ink-800 bg-ink-900 p-3 text-sm">
          <dt className="text-ink-500">Servicio</dt>
          <dd className="text-right">{service.name}</dd>
          {step > 2 && (
            <>
              <dt className="text-ink-500">Barbero</dt>
              <dd className="text-right">{barber?.name ?? "Cualquiera disponible"}</dd>
            </>
          )}
          {step > 3 && slot && (
            <>
              <dt className="text-ink-500">Fecha</dt>
              <dd className="text-right">
                {formatLongDate(slot.startsAt)}, {formatTime(slot.startsAt)}
              </dd>
              <dt className="text-ink-500">Total</dt>
              <dd className="text-right font-semibold text-brass-300">{formatCop(service.priceCop)}</dd>
            </>
          )}
        </dl>
      )}

      {step === 1 && (
        <ul className="space-y-2">
          {services.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  setServiceId(s.id);
                  setBarberId(undefined);
                  setSlot(null);
                  setStep(2);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-4 rounded-xl border bg-ink-900 p-4 text-left transition hover:border-brass-500",
                  s.id === serviceId ? "border-brass-400" : "border-ink-800",
                )}
              >
                <div className="min-w-0">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-ink-500">{formatDuration(s.durationMin)}</p>
                </div>
                <p className="shrink-0 font-semibold text-brass-300">{formatCop(s.priceCop)}</p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {step === 2 && service && (
        <ul className="space-y-2">
          {[{ id: null, name: "Cualquiera disponible", bio: "Te asignamos el barbero libre en el horario que elijas." }, ...availableBarbers].map(
            (b) => (
              <li key={b.id ?? "any"}>
                <button
                  type="button"
                  onClick={() => {
                    setBarberId(b.id);
                    setSlot(null);
                    setStep(3);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border bg-ink-900 p-4 text-left transition hover:border-brass-500",
                    barberId === b.id ? "border-brass-400" : "border-ink-800",
                  )}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink-800 font-display text-brass-300">
                    {b.id ? b.name.charAt(0) : "★"}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">{b.name}</span>
                    {b.bio && <span className="block text-sm text-ink-500">{b.bio}</span>}
                  </span>
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      {step === 3 && service && barberId !== undefined && (
        <div className="space-y-5">
          {formError && <ErrorBox message={formError} />}
          <SlotPicker
            serviceId={service.id}
            barberId={barberId}
            selected={slot}
            reloadKey={reloadKey}
            onSelect={(s) => {
              setSlot(s);
              setFormError(null);
            }}
          />
          <button
            type="button"
            disabled={!slot}
            onClick={() => setStep(4)}
            className="sticky bottom-4 w-full rounded-full bg-brass-400 py-3 font-semibold text-ink-950 shadow-lg shadow-black/40 transition hover:bg-brass-300 disabled:cursor-not-allowed disabled:bg-ink-800 disabled:text-ink-500 disabled:shadow-none"
          >
            {slot ? `Continuar con ${formatTime(slot.startsAt)}` : "Elige un horario"}
          </button>
        </div>
      )}

      {step === 4 && service && slot && (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Nombre" error={fieldErrors.name}>
            <input
              name="name"
              autoComplete="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass(!!fieldErrors.name)}
              placeholder="Tu nombre"
            />
          </Field>
          <Field label="WhatsApp" error={fieldErrors.phone} hint="Te enviaremos la confirmación y los recordatorios.">
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={inputClass(!!fieldErrors.phone)}
              placeholder="300 123 4567"
            />
          </Field>
          <Field label="Nota (opcional)" error={fieldErrors.note}>
            <textarea
              name="note"
              rows={3}
              maxLength={300}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className={inputClass(!!fieldErrors.note)}
              placeholder="Ej: quiero mantener el largo arriba"
            />
          </Field>
          {/* Campo trampa para bots: invisible para personas */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            className="hidden"
            aria-hidden
          />

          {formError && <ErrorBox message={formError} />}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full bg-brass-400 py-3 font-semibold text-ink-950 transition hover:bg-brass-300 disabled:opacity-60"
          >
            {pending ? "Reservando…" : "Confirmar reserva"}
          </button>
        </form>
      )}
    </div>
  );
}

function inputClass(invalid: boolean) {
  return cn(
    "w-full rounded-xl border bg-ink-900 px-4 py-3 text-base text-ink-100 placeholder:text-ink-500 outline-none transition focus:border-brass-400",
    invalid ? "border-red-500/70" : "border-ink-800",
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-ink-300">{label}</span>
      {children}
      {error ? <span className="block text-sm text-red-400">{error}</span> : hint && <span className="block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">
      {message}
    </p>
  );
}
