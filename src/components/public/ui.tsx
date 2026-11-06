import { cn } from "@/lib/cn";

/** Botón principal del sitio público: rectangular, tinta sobre papel. */
export const btnPrimary =
  "inline-flex items-center justify-center gap-3 bg-char px-6 py-3.5 text-[0.95rem] font-medium text-paper-light transition-colors hover:bg-oxblood focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood disabled:cursor-not-allowed disabled:bg-paper-deep disabled:text-char-mute";

/** Botón secundario: solo borde. */
export const btnSecondary =
  "inline-flex items-center justify-center gap-2 border border-char/80 px-5 py-3 text-[0.95rem] font-medium text-char transition-colors hover:bg-char hover:text-paper-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood disabled:opacity-50";

/** Enlace de texto subrayado fino. */
export const textLink =
  "underline decoration-rule decoration-1 underline-offset-[5px] transition-colors hover:text-oxblood hover:decoration-oxblood";

export const inputBase =
  "w-full border bg-paper-light px-4 py-3 text-base text-char placeholder:text-char-mute/70 outline-none transition-colors focus:border-char";

export function Arrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 10" aria-hidden className={cn("h-2.5 w-5 shrink-0", className)} fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M0 5h18.5M14.5 1l4 4-4 4" />
    </svg>
  );
}

/** Inicial del barbero en serif cursiva dentro de un círculo fino (o su foto, si tiene). */
export function Monogram({ name, photoUrl, size = "md" }: { name: string; photoUrl?: string | null; size?: "sm" | "md" | "lg" }) {
  const dims = { sm: "size-10 text-lg", md: "size-14 text-2xl", lg: "size-20 text-4xl" }[size];
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt="" className={cn(dims, "shrink-0 rounded-full object-cover grayscale-[30%]")} />;
  }
  return (
    <span
      aria-hidden
      className={cn(dims, "flex shrink-0 items-center justify-center rounded-full border border-char/70 font-serif italic text-char")}
    >
      {name.trim().charAt(0)}
    </span>
  );
}

export function Notice({ tone, children, role }: { tone: "error" | "success" | "info"; children: React.ReactNode; role?: "alert" | "status" }) {
  return (
    <div
      role={role ?? (tone === "error" ? "alert" : "status")}
      className={cn(
        "border-l-2 px-4 py-3 text-sm leading-relaxed",
        tone === "error" && "border-oxblood bg-oxblood/[0.07] text-oxblood-deep",
        tone === "success" && "border-moss bg-moss/[0.08] text-moss",
        tone === "info" && "border-rule bg-paper-deep/50 text-char-soft",
      )}
    >
      {children}
    </div>
  );
}
