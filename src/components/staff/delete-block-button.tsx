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
      className="border border-rule px-3 py-1 text-xs text-char-soft transition hover:border-oxblood/50 hover:text-oxblood disabled:opacity-50"
    >
      {pending ? "…" : "Quitar"}
    </button>
  );
}
