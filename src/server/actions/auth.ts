"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, deleteSession, homeFor } from "../auth/dal";
import { db } from "../db";

const loginSchema = z.object({
  email: z.email("Escribe un correo válido").trim().toLowerCase(),
  password: z.string().min(1, "Escribe tu contraseña").max(200),
  next: z.string().optional(),
});

export type LoginState = { error?: string; email?: string } | undefined;

// Hash ficticio para comparar aunque el correo no exista: misma demora, no revela qué correos existen.
let dummyHash: string | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync("contraseña-ficticia", 10));

/** Solo rutas internas: evita redirecciones abiertas a otros sitios. */
function safeNext(next: string | undefined, fallback: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos", email: String(formData.get("email") ?? "") };
  }
  const { email, password, next } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? getDummyHash());
  if (!user || !valid || !user.active) {
    return { error: "Correo o contraseña incorrectos.", email };
  }

  await createSession({ userId: user.id, role: user.role });
  const home = homeFor(user.role);
  // Un barbero no puede saltar al panel de admin con ?next=
  const target = safeNext(next, home);
  redirect(target.startsWith(home) ? target : home);
}

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}
