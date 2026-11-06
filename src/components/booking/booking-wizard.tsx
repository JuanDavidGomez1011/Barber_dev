"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { formatCop, formatDuration, formatLongDate, formatTime } from "@/lib/format";
import { customerSchema } from "@/lib/validation/booking";
import { createBookingAction } from "@/server/actions/booking";
import type { PublicBarber, PublicService } from "@/server/catalog";
import { Arrow, btnPrimary, inputBase, Monogram, Notice } from "../public/ui";
import { SlotPicker, type Slot } from "./slot-picker";

interface Props {
  services: PublicService[];
  barbers: PublicBarber[];
}

type Step = 1 | 2 | 3 | 4;
const STEP_TITLES: Record<Step, string> = {
  1: "¿Qué te hacemos?",
  2: "¿Con quién?",
  3: "Día y hora",
  4: "Tus datos",
};
const STEP_LABELS = ["Servicio", "Barbero", "Horario", "Datos"] as const;

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

  // Al cambiar de paso, volver arriba si el inicio del asistente quedó fuera de la pantalla.
  const topRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const el = topRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
  }, [step]);

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
    <div ref={topRef} className="scroll-mt-24 space-y-8">
      {/* Progreso: pasos numerados; los ya hechos se pueden tocar para volver */}
      <nav aria-label="Pasos de la reserva">
        <ol className="grid grid-cols-4 border-t border-rule">
          {STEP_LABELS.map((label, i) => {
            const n = (i + 1) as Step;
            const done = n < step;
            const current = n === step;
            return (
              <li key={label} className={cn("-mt-px border-t-2 pt-3", current || done ? "border-char" : "border-transparent")}>
                <button
                  type="button"
                  disabled={!done}
                  onClick={() => setStep(n)}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex items-baseline gap-2 text-left disabled:cursor-default",
                    current ? "text-char" : done ? "text-char-soft hover:text-oxblood" : "text-char-mute/70",
                  )}
                >
                  <span className="font-serif text-sm italic tabular-nums">{String(n).padStart(2, "0")}</span>
                  <span className="label-caps hidden sm:inline">{label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="label-caps mb-3 text-char-mute">
            Paso {step} de 4<span className="sm:hidden"> · {STEP_LABELS[step - 1]}</span>
          </p>
          <h1 className="font-serif text-[2.2rem] leading-tight tracking-tight sm:text-[2.7rem]">{STEP_TITLES[step]}</h1>
        </div>
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep((s) => (s - 1) as Step)}
            className="mb-2 shrink-0 text-sm text-char-soft underline decoration-rule underline-offset-[5px] hover:text-oxblood"
          >
            Atrás
          </button>
        )}
      </header>

      {/* Resumen de lo elegido */}
      {step > 1 && service && (
        <dl className="divide-y divide-rule/70 border-y border-rule text-sm">
          <SummaryRow label="Servicio" value={`${service.name} · ${formatDuration(service.durationMin)}`} />
          {step > 2 && <SummaryRow label="Barbero" value={barber?.name ?? "Cualquiera disponible"} />}
          {step > 3 && slot && (
            <>
              <SummaryRow label="Fecha" value={`${formatLongDate(slot.startsAt)}, ${formatTime(slot.startsAt)}`} />
              <SummaryRow label="Total" value={formatCop(service.priceCop)} strong />
            </>
          )}
        </dl>
      )}

      {step === 1 && (
        <ul className="divide-y divide-rule/70 border-t border-char">
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
                className="group w-full py-4 text-left"
              >
                <span className="flex items-baseline gap-3">
                  <span className={cn("font-serif text-xl transition-colors group-hover:text-oxblood", s.id === serviceId && "text-oxblood")}>
                    {s.name}
                  </span>
                  <span className="leader" aria-hidden />
                  <span className="shrink-0 font-medium tabular-nums">{formatCop(s.priceCop)}</span>
                </span>
                <span className="mt-1 flex justify-between gap-4 text-sm text-char-mute">
                  <span>{s.description}</span>
                  <span className="shrink-0">{formatDuration(s.durationMin)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {step === 2 && service && (
        <ul className="divide-y divide-rule/70 border-t border-char">
          {[
            { id: null, name: "Cualquiera disponible", bio: "Te asignamos a quien esté libre a la hora que elijas.", photoUrl: null },
            ...availableBarbers,
          ].map((b) => (
            <li key={b.id ?? "any"}>
              <button
                type="button"
                onClick={() => {
                  setBarberId(b.id);
                  setSlot(null);
                  setStep(3);
                }}
                className="group flex w-full items-center gap-4 py-4 text-left"
              >
                {b.id ? (
                  <Monogram name={b.name} photoUrl={b.photoUrl} size="sm" />
                ) : (
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-dashed border-char/60 font-serif text-lg text-char-soft italic"
                  >
                    ?
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className={cn("block font-serif text-xl transition-colors group-hover:text-oxblood", barberId === b.id && "text-oxblood")}>
                    {b.name}
                  </span>
                  {b.bio && <span className="block text-sm text-char-mute">{b.bio}</span>}
                </span>
                <Arrow className="text-char-mute transition-transform group-hover:translate-x-1 group-hover:text-oxblood" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {step === 3 && service && barberId !== undefined && (
        <div className="space-y-6">
          {formError && <Notice tone="error">{formError}</Notice>}
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
          <div className="sticky bottom-0 -mx-5 border-t border-rule bg-paper/95 px-5 py-4 backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <button type="button" disabled={!slot} onClick={() => setStep(4)} className={cn(btnPrimary, "w-full")}>
              {slot ? (
                <>
                  Continuar con las {formatTime(slot.startsAt)} <Arrow />
                </>
              ) : (
                "Elige un horario"
              )}
            </button>
          </div>
        </div>
      )}

      {step === 4 && service && slot && (
        <form onSubmit={submit} className="space-y-5" noValidate>
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
          <Field label="WhatsApp" error={fieldErrors.phone} hint="Ahí te llegan la confirmación y los recordatorios.">
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
          <Field label="Nota para el barbero (opcional)" error={fieldErrors.note}>
            <textarea
              name="note"
              rows={3}
              maxLength={300}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className={inputClass(!!fieldErrors.note)}
              placeholder="Ej: mantener el largo arriba"
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

          {formError && <Notice tone="error">{formError}</Notice>}

          <button type="submit" disabled={pending} className={cn(btnPrimary, "w-full")}>
            {pending ? (
              "Reservando…"
            ) : (
              <>
                Confirmar reserva <Arrow />
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-2.5">
      <dt className="label-caps shrink-0 text-char-mute">{label}</dt>
      <dd className={cn("text-right", strong && "font-serif text-lg text-oxblood")}>{value}</dd>
    </div>
  );
}

function inputClass(invalid: boolean) {
  return cn(inputBase, invalid ? "border-oxblood" : "border-rule");
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="label-caps block text-char-soft">{label}</span>
      {children}
      {error ? <span className="block text-sm text-oxblood">{error}</span> : hint && <span className="block text-xs text-char-mute">{hint}</span>}
    </label>
  );
}
