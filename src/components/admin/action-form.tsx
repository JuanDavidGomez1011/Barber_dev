"use client";

import { startTransition, useActionState, useRef } from "react";
import { cn } from "@/lib/cn";
import type { FormState } from "@/server/actions/admin";
import { buttonClass } from "./ui";

/**
 * Formulario conectado a una Server Action con `useActionState`.
 * Los campos llegan como `children` (pueden venir de un Server Component).
 *
 * Se envía a mano (no con `<form action>`) porque React vacía el formulario
 * después de cada envío, incluso cuando hay un error de validación, y el usuario
 * perdería lo que escribió. Con `resetOnSuccess` se vacía solo si salió bien
 * (útil en formularios de "crear").
 */
export function ActionForm({
  action,
  children,
  submitLabel = "Guardar",
  className,
  resetOnSuccess = false,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const result = await action(prev, fd);
    if (result?.ok && resetOnSuccess) formRef.current?.reset();
    return result;
  }, undefined);

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className={cn("space-y-4", className)}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Guardando…" : submitLabel}
        </button>
        {state && (
          <p role={state.ok ? "status" : "alert"} className={cn("text-sm", state.ok ? "text-moss" : "text-oxblood")}>
            {state.ok ? state.message : state.error}
          </p>
        )}
      </div>
    </form>
  );
}
