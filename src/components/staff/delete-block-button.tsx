"use client";

import { useTransition } from "react";
import { deleteBlockAction } from "@/server/actions/barber";

export function DeleteBlockButton({ blockId }: { blockId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await deleteBlockAction(blockId);
          if (!res.ok) alert(res.error);
        })
      }
      className="rounded-full border border-ink-700 px-3 py-1 text-xs text-ink-300 transition hover:border-red-700 hover:text-red-300 disabled:opacity-50"
    >
      {pending ? "…" : "Quitar"}
    </button>
  );
}
