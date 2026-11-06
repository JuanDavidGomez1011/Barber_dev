import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { getCatalog } from "@/server/catalog";

export const metadata: Metadata = { title: "Ingresar", robots: { index: false } };

export default async function LoginPage() {
  const { business } = await getCatalog();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <div className="mb-8 space-y-1 text-center">
        <Link href="/" className="font-display text-2xl font-semibold">
          {business.name}
        </Link>
        <p className="text-sm text-ink-500">Acceso para barberos y administración</p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
