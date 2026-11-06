"use client";

import { useState, useTransition } from "react";
import { createBlockAction } from "@/server/actions/barber";

const input =
  "w-full border border-rule bg-paper-light px-3 py-2.5 text-base text-char outline-none transition-colors focus:border-char";

const PRESETS = [
  { label: "Almuerzo", start: "13:00", end: "14:00" },
  { label: "Permiso", start: "", end: "" },
  { label: "Capacitación", start: "", end: "" },
];

export function BlockForm({ today }: { today: string }) {
  const [form, setForm] = useState({ date: today, start: "13:00", end: "14:00", allDay: false, reason: "Almuerzo", repeat: false, repeatUntil: "" });
  const [result, setResult] = useState<{ ok: boolean; text: string; conflicts?: string[] } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const res = await createBlockAction({
        date: form.date,
        allDay: form.allDay,
        start: form.start,
        end: form.end,
        reason: form.reason,
        repeatUntil: form.repeat ? form.repeatUntil : "",
      });
      if (res.ok) setResult({ ok: true, text: res.message ?? "Listo." });
      else setResult({ ok: false, text: res.error, conflicts: res.conflicts });
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 border border-rule bg-paper-light p-4">
      <h2 className="font-serif text-2xl tracking-tight">Nuevo bloqueo</h2>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setForm({ ...form, reason: p.label, ...(p.start ? { start: p.start, end: p.end, allDay: false } : {}) })}
            className="border border-rule px-3 py-1 text-xs hover:border-char"
          >
            {p.label}
          </button>
        ))}
      </div>

      <label className="block space-y-1.5">
        <span className="label-caps block text-char-soft">Motivo</span>
        <input className={input} value={form.reason} maxLength={100} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
      </label>

      <label className="block space-y-1.5">
        <span className="label-caps block text-char-soft">Fecha</span>
        <input type="date" required min={today} className={input} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.allDay} onChange={(e) => setForm({ ...form, allDay: e.target.checked })} className="size-4 accent-char" />
        Todo el día
      </label>

      {!form.allDay && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="label-caps block text-char-soft">Desde</span>
            <input type="time" step={900} required className={input} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
          </label>
          <label className="block space-y-1.5">
            <span className="label-caps block text-char-soft">Hasta</span>
            <input type="time" step={900} required className={input} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
          </label>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.checked })} className="size-4 accent-char" />
        Repetir en mis días de trabajo
      </label>
      {form.repeat && (
        <label className="block space-y-1.5">
          <span className="label-caps block text-char-soft">Hasta (máximo 60 días)</span>
          <input type="date" required min={form.date} className={input} value={form.repeatUntil} onChange={(e) => setForm({ ...form, repeatUntil: e.target.value })} />
        </label>
      )}

      {result && (
        <div
          role={result.ok ? "status" : "alert"}
          className={` border p-3 text-sm ${result.ok ? "border-moss/40 bg-moss/10 text-moss" : "border-oxblood/50 bg-oxblood/10 text-oxblood"}`}
        >
          <p>{result.text}</p>
          {result.conflicts && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5">
              {result.conflicts.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-char py-3 font-medium text-paper-light transition-colors hover:bg-oxblood disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Bloquear horario"}
      </button>
    </form>
  );
}
