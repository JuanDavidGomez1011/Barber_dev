"use client";

import { useState, useTransition } from "react";
import { createBlockAction } from "@/server/actions/barber";

const input =
  "w-full rounded-xl border border-ink-800 bg-ink-950 px-3 py-2.5 text-base outline-none focus:border-brass-400 [color-scheme:dark]";

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
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-ink-800 bg-ink-900 p-4">
      <h2 className="font-display text-xl font-semibold">Nuevo bloqueo</h2>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setForm({ ...form, reason: p.label, ...(p.start ? { start: p.start, end: p.end, allDay: false } : {}) })}
            className="rounded-full border border-ink-700 px-3 py-1 text-xs hover:border-brass-500"
          >
            {p.label}
          </button>
        ))}
      </div>

      <label className="block space-y-1">
        <span className="text-sm text-ink-300">Motivo</span>
        <input className={input} value={form.reason} maxLength={100} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-ink-300">Fecha</span>
        <input type="date" required min={today} className={input} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.allDay} onChange={(e) => setForm({ ...form, allDay: e.target.checked })} className="size-4 accent-brass-400" />
        Todo el día
      </label>

      {!form.allDay && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm text-ink-300">Desde</span>
            <input type="time" step={900} required className={input} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-ink-300">Hasta</span>
            <input type="time" step={900} required className={input} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
          </label>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.checked })} className="size-4 accent-brass-400" />
        Repetir en mis días de trabajo
      </label>
      {form.repeat && (
        <label className="block space-y-1">
          <span className="text-sm text-ink-300">Hasta (máximo 60 días)</span>
          <input type="date" required min={form.date} className={input} value={form.repeatUntil} onChange={(e) => setForm({ ...form, repeatUntil: e.target.value })} />
        </label>
      )}

      {result && (
        <div
          role={result.ok ? "status" : "alert"}
          className={`rounded-xl border p-3 text-sm ${result.ok ? "border-emerald-800 bg-emerald-950/50 text-emerald-200" : "border-red-900/60 bg-red-950/40 text-red-200"}`}
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
        className="w-full rounded-full bg-brass-400 py-3 font-semibold text-ink-950 transition hover:bg-brass-300 disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Bloquear horario"}
      </button>
    </form>
  );
}
