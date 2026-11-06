"use client";

import { useState, useTransition } from "react";
import type { FormState } from "@/server/actions/admin";
import { buttonClass } from "./ui";

/** Botón de acción destructiva con confirmación en dos pasos (sin `window.confirm`). */
export function ConfirmActionButton({
  action,
  label,
  confirmLabel = "¿Seguro?",
  variant = "danger",
}: {
  action: () => Promise<FormState>;
  label: string;
  confirmLabel?: string;
  variant?: keyof typeof buttonClass;
}) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!asking) {
    return (
      <span className="inline-flex flex-col items-start gap-1">
        <button type="button" onClick={() => setAsking(true)} className={buttonClass[variant]}>
          {label}
        </button>
        {error && <span className="text-xs text-red-300">{error}</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-sm text-ink-300">{confirmLabel}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await action();
            setAsking(false);
            setError(res && !res.ok ? (res.error ?? "Error") : null);
          })
        }
        className={buttonClass.danger}
      >
        {pending ? "…" : "Sí"}
      </button>
      <button type="button" disabled={pending} onClick={() => setAsking(false)} className={buttonClass.secondary}>
        No
      </button>
    </span>
  );
}
