"use client";

import { useState } from "react";
import { textLink } from "../public/ui";

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
      className={textLink}
    >
      {copied ? "Enlace copiado" : "Copiar enlace"}
    </button>
  );
}
