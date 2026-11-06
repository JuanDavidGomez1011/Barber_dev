import { cn } from "@/lib/cn";

export const STATUS_META: Record<string, { label: string; className: string; dot: string }> = {
  CONFIRMED: { label: "Confirmada", className: "bg-moss/10 text-moss border-moss/40", dot: "bg-moss" },
  COMPLETED: { label: "Completada", className: "bg-paper-deep text-char-soft border-rule", dot: "bg-char-mute" },
  CANCELLED: { label: "Cancelada", className: "bg-oxblood/10 text-oxblood border-oxblood/50", dot: "bg-oxblood" },
  NO_SHOW: { label: "No asistió", className: "bg-amber-100 text-amber-800 border-amber-700/40", dot: "bg-amber-600" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn("label-caps shrink-0 border px-2 py-1 !text-[0.62rem]", meta.className, className)}>
      {meta.label}
    </span>
  );
}
