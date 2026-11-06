/** Piezas de interfaz compartidas por el panel de administración (sin estado). */
import { cn } from "@/lib/cn";

export const inputClass =
  "w-full border border-rule bg-paper-light px-3 py-2.5 text-base text-char outline-none transition-colors placeholder:text-char-mute/70 focus:border-char";

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="label-caps block text-char-soft">{label}</span>
      {children}
      {hint && <span className="block text-xs text-char-mute">{hint}</span>}
    </label>
  );
}

export function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2.5 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-4 accent-char" />
      {label}
    </label>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("border border-rule bg-paper-light p-5", className)}>{children}</section>;
}

export function PageTitle({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-char pb-5">
      <div>
        <h1 className="font-serif text-[2.2rem] leading-tight tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 max-w-xl text-sm text-char-mute">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-paper-deep/60", className ?? "h-64")} />;
}

export const buttonClass = {
  primary:
    "inline-flex items-center justify-center gap-2 bg-char px-5 py-2.5 text-sm font-medium text-paper-light transition-colors hover:bg-oxblood disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-2 border border-char/70 px-4 py-2 text-sm font-medium text-char transition-colors hover:bg-char hover:text-paper-light disabled:opacity-50",
  danger:
    "inline-flex items-center justify-center gap-2 border border-oxblood/60 px-4 py-2 text-sm font-medium text-oxblood transition-colors hover:bg-oxblood hover:text-paper-light disabled:opacity-50",
};
