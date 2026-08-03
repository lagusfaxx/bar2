"use client";

import { Printer } from "lucide-react";

/** Abre el diálogo de impresión sin obligar a buscarlo en el menú del navegador. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-11 items-center gap-2 bg-crimson px-5 text-sm font-medium text-bone transition-colors hover:bg-crimson-bright"
    >
      <Printer className="size-4" aria-hidden />
      Imprimir ahora
    </button>
  );
}
