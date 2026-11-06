import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { getCatalog } from "@/server/catalog";

export const metadata: Metadata = { title: "Ingresar", robots: { index: false } };

export default async function LoginPage() {
  const { business } = await getCatalog();

  return (
    <div className="theme-paper flex min-h-full flex-1 flex-col">
      <div className="barber-stripe" aria-hidden />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-16">
        <div className="mb-10 space-y-3">
          <p className="label-caps text-char-mute">Acceso del equipo</p>
          <h1 className="font-serif text-[2.4rem] leading-tight tracking-tight">{business.name}</h1>
          <p className="text-sm text-char-mute">Barberos y administración.</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
        <Link href="/" className="mt-10 text-sm text-char-mute underline decoration-rule underline-offset-[5px] hover:text-oxblood">
          Volver al sitio
        </Link>
      </main>
    </div>
  );
}
