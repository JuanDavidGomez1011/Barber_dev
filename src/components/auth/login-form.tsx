"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { loginAction } from "@/server/actions/auth";

export function LoginForm() {
  const next = useSearchParams().get("next") ?? "";
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-ink-300">Correo</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state?.email}
          className="w-full rounded-xl border border-ink-800 bg-ink-900 px-4 py-3 text-base outline-none focus:border-brass-400"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-ink-300">Contraseña</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-xl border border-ink-800 bg-ink-900 px-4 py-3 text-base outline-none focus:border-brass-400"
        />
      </label>
      {state?.error && (
        <p role="alert" className="rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-brass-400 py-3 font-semibold text-ink-950 transition hover:bg-brass-300 disabled:opacity-60"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
