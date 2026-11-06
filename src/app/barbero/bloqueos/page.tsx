import { Suspense } from "react";
import { BlockForm } from "@/components/staff/block-form";
import { DeleteBlockButton } from "@/components/staff/delete-block-button";
import { formatLongDate, formatTime } from "@/lib/format";
import { toDateISO } from "@/lib/time";
import { requireBarber } from "@/server/auth/dal";
import { listUpcomingBlocks } from "@/server/services/agenda.service";

export default function BlocksPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse bg-paper-light" />}>
      <Blocks />
    </Suspense>
  );
}

async function Blocks() {
  const { barber } = await requireBarber();
  const now = new Date();
  const blocks = await listUpcomingBlocks(barber.id, now);

  return (
    <div className="grid gap-6 md:grid-cols-2 md:items-start">
      <BlockForm today={toDateISO(now)} />

      <section className="space-y-3">
        <h2 className="font-serif text-2xl tracking-tight">Próximos bloqueos</h2>
        <p className="text-sm text-char-mute">En estos horarios los clientes no pueden reservar contigo.</p>
        {blocks.length === 0 ? (
          <p className=" border border-dashed border-rule p-6 text-center text-sm text-char-mute">
            No tienes bloqueos próximos.
          </p>
        ) : (
          <ul className="divide-y divide-rule border border-rule bg-paper-light">
            {blocks.map((b) => {
              const allDay = b.endsAt.getTime() - b.startsAt.getTime() >= 24 * 3600_000 - 60_000;
              return (
                <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">{formatLongDate(b.startsAt)}</p>
                    <p className="text-char-mute">
                      {allDay ? "Todo el día" : `${formatTime(b.startsAt)} – ${formatTime(b.endsAt)}`}
                      {b.reason && ` · ${b.reason}`}
                    </p>
                  </div>
                  <DeleteBlockButton blockId={b.id} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
