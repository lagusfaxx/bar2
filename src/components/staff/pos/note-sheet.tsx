"use client";

import { Loader2, X } from "lucide-react";
import { useState, useTransition } from "react";

import { setItemNote } from "@/app/actions/pos";
import { Keyboard } from "@/components/staff/pos/keyboard";
import { useTecladoPropio } from "@/components/staff/pos/use-teclado-propio";

/**
 * Notas de uso frecuente.
 *
 * Son las que se dictan una y otra vez en cualquier bar. Estan como botones
 * para que el garzon no tenga que escribir con el local lleno; igual queda el
 * campo libre para lo que no esta en la lista.
 */
const QUICK_NOTES = [
  "Sin cebolla",
  "Sin lechuga",
  "Sin tomate",
  "Sin mayo",
  "Sin hielo",
  "Sin sal",
  "Poco cocido",
  "Bien cocido",
  "Extra picante",
  "Sin picante",
  "Para compartir",
  "Sin gluten",
] as const;

/**
 * Nota de una linea: "sin lechuga", "bien cocido".
 *
 * Las mas comunes son botones y no texto libre: con el local lleno, escribir
 * en un telefono es lo primero que el garzon deja de hacer. Se pueden acumular
 * varias y el campo libre queda para lo que no esta en la lista.
 */
export function NoteSheet({
  itemId,
  itemName,
  current,
  onClose,
}: {
  itemId: string;
  itemName: string;
  current: string | null;
  onClose: () => void;
}) {
  const [note, setNote] = useState(current ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  /**
   * El teclado de la app, solo donde hace falta.
   *
   * En la pantalla del mostrador no hay ninguno del sistema que aparezca al
   * enfocar el campo, asi que sin esto la nota libre es letra muerta: quedan
   * solo los botones de arriba. En el telefono sobra: el campo es un campo
   * normal y el teclado lo levanta el aparato.
   */
  const propio = useTecladoPropio();
  /** Con el teclado de la app: si esta abierto. Empieza cerrado porque casi
      siempre alcanza con las notas rapidas. */
  const [tecleando, setTecleando] = useState(false);

  /** Agrega o quita la nota rapida, sin pisar lo que ya estaba escrito. */
  const toggle = (quick: string) => {
    const parts = note
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    const index = parts.findIndex(
      (part) => part.toLowerCase() === quick.toLowerCase(),
    );

    if (index >= 0) parts.splice(index, 1);
    else parts.push(quick);

    setNote(parts.join(", "));
  };

  const active = (quick: string) =>
    note
      .split(",")
      .some((part) => part.trim().toLowerCase() === quick.toLowerCase());

  const save = () => {
    startTransition(async () => {
      const result = await setItemNote(itemId, note);

      if (result.status === "error") {
        setError(result.message ?? "No se pudo guardar la nota.");
        return;
      }

      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-60 flex h-[100dvh] items-end bg-ink/80 backdrop-blur-sm">
      <div className="max-h-full w-full overflow-y-auto overscroll-contain border-t border-line bg-ink-soft p-5 pb-safe">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted">
              Nota para
            </p>
            <h2 className="truncate font-display text-xl text-bone">{itemName}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-11 shrink-0 items-center justify-center border border-line text-bone"
            aria-label="Cerrar"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_NOTES.map((quick) => (
            <button
              key={quick}
              type="button"
              onClick={() => toggle(quick)}
              aria-pressed={active(quick)}
              className={[
                "h-11 border px-3 text-sm transition-colors",
                active(quick)
                  ? "border-gilt bg-gilt/15 text-gilt-soft"
                  : "border-line text-bone-dim",
              ].join(" ")}
            >
              {quick}
            </button>
          ))}
        </div>

        <label className="mt-5 block">
          <span className="text-[0.6rem] uppercase tracking-[0.2em] text-muted">
            Nota
          </span>
          <textarea
            value={note}
            readOnly={propio}
            onChange={(event) => setNote(event.target.value)}
            onFocus={propio ? () => setTecleando(true) : undefined}
            onClick={propio ? () => setTecleando(true) : undefined}
            rows={2}
            maxLength={140}
            placeholder="Lo que haga falta aclarar"
            className={[
              "mt-2 w-full border border-line bg-ink px-3 py-2 text-bone placeholder:text-muted focus:border-crimson focus:outline-none",
              propio ? "cursor-pointer" : "",
            ].join(" ")}
          />
        </label>

        {propio && tecleando && (
          <div className="mt-3 -mx-5">
            <Keyboard
              onKey={(char) => setNote((actual) => (actual + char).slice(0, 140))}
              onBackspace={() => setNote((actual) => actual.slice(0, -1))}
              onClear={() => setNote("")}
              onDone={() => setTecleando(false)}
            />
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-crimson-bright">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => setNote("")}
            className="h-14 flex-1 border border-line text-sm uppercase tracking-[0.16em] text-muted"
          >
            Limpiar
          </button>

          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="flex h-14 flex-[1.6] items-center justify-center gap-2 bg-crimson text-sm font-medium uppercase tracking-[0.16em] text-bone disabled:opacity-60"
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Guardar nota
          </button>
        </div>
      </div>
    </div>
  );
}
