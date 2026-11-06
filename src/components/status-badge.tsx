import { cn } from "@/lib/cn";

export const STATUS_META: Record<string, { label: string; className: string; dot: string }> = {
  CONFIRMED: { label: "Confirmada", className: "bg-emerald-950 text-emerald-300 border-emerald-800", dot: "bg-emerald-400" },
  COMPLETED: { label: "Completada", className: "bg-ink-800 text-ink-300 border-ink-700", dot: "bg-ink-500" },
  CANCELLED: { label: "Cancelada", className: "bg-red-950 text-red-300 border-red-900", dot: "bg-red-500" },
  NO_SHOW: { label: "No asistió", className: "bg-amber-950 text-amber-300 border-amber-900", dot: "bg-amber-400" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn("shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold", meta.className, className)}>
      {meta.label}
    </span>
  );
}
