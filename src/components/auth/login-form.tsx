"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { cn } from "@/lib/cn";
import { loginAction } from "@/server/actions/auth";
import { Arrow, btnPrimary, inputBase, Notice } from "../public/ui";

export function LoginForm() {
  const next = useSearchParams().get("next") ?? "";
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <label className="block space-y-2">
        <span className="label-caps block text-char-soft">Correo</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state?.email}
          className={cn(inputBase, "border-rule")}
        />
      </label>
      <label className="block space-y-2">
        <span className="label-caps block text-char-soft">Contraseña</span>
        <input name="password" type="password" autoComplete="current-password" required className={cn(inputBase, "border-rule")} />
      </label>
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      <button type="submit" disabled={pending} className={cn(btnPrimary, "w-full")}>
        {pending ? (
          "Entrando…"
        ) : (
          <>
            Entrar <Arrow />
          </>
        )}
      </button>
    </form>
  );
}
