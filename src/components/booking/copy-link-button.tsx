"use client";

import { useState } from "react";

/** Copia la URL actual (sin parámetros) al portapapeles. */
export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        const url = window.location.origin + window.location.pathname;
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copia tu enlace:", url);
        }
      }}
      className="rounded-full border border-ink-700 px-4 py-2 text-sm transition hover:border-brass-500"
    >
      {copied ? "¡Enlace copiado!" : "Copiar enlace"}
    </button>
  );
}
