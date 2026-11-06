/** Piezas de interfaz compartidas por el panel de administración (sin estado). */
import { cn } from "@/lib/cn";

export const inputClass =
  "w-full rounded-xl border border-ink-800 bg-ink-950 px-3 py-2.5 text-base text-ink-100 outline-none transition placeholder:text-ink-500 focus:border-brass-400 [color-scheme:dark]";

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1", className)}>
      <span className="text-sm text-ink-300">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}

export function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-4 accent-brass-400" />
      {label}
    </label>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl border border-ink-800 bg-ink-900 p-4", className)}>{children}</section>;
}

export function PageTitle({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-ink-900", className ?? "h-64")} />;
}

export const buttonClass = {
  primary:
    "rounded-full bg-brass-400 px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brass-300 disabled:opacity-60",
  secondary:
    "rounded-full border border-ink-700 px-4 py-2 text-sm font-medium text-ink-100 transition hover:border-brass-500 disabled:opacity-60",
  danger:
    "rounded-full border border-red-900 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-950 disabled:opacity-60",
};
