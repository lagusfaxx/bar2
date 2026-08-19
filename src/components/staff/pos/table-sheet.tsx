"use client";

import { Loader2, X } from "lucide-react";
import { useState, useTransition } from "react";

import { setSessionTag, setSessionWaiter } from "@/app/actions/pos";
import { IDLE, type FormState } from "@/lib/form-state";
import { TAG_COLORS, TAG_PRESETS, type TagColor } from "@/lib/pos-style";

/**
 * Quien atiende la mesa y como esta marcada.
 *
 * Son las dos cosas que se dicen de una mesa antes de hablar de lo que
 * consumio: "la 7 la lleva Anaís" y "ojo que es un cumpleaños". Van juntas en
 * una sola hoja porque se dicen en la misma frase, y ambas se resuelven con un
 * toque: el garzon esta de pie, con el local lleno.
 *
 * Se guarda al tocar "Listo" y no en cada toque: asi se puede cambiar de
 * opinion sin dejar la mesa marcada a medias, y se hace un solo viaje al
 * servidor por cada cosa que efectivamente cambio.
 */
export function TableSheet({
  sessionId,
  tableNumber,
  waiterId,
  tag,
  tagColorKey,
  staff,
  me,
  onClose,
  onDone,
}: {
  sessionId: string;
  tableNumber: number;
  waiterId: string | null;
  tag: string | null;
  tagColorKey: string | null;
  staff: Array<{ id: string; name: string }>;
  /** Quien esta usando este telefono: aparece primero en la lista. */
  me: string;
  onClose: () => void;
  onDone: (result: FormState) => void;
}) {
  const [waiter, setWaiter] = useState<string | null>(waiterId);
  const [etiqueta, setEtiqueta] = useState(tag ?? "");
  const [color, setColor] = useState<TagColor>(
    tagColorKey && tagColorKey in TAG_COLORS ? (tagColorKey as TagColor) : "gilt",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Quien tiene el telefono en la mano arriba de todo: nueve de cada diez
  // veces la mesa pasa a ser suya, y buscarse a uno mismo en una lista
  // alfabetica de quince nombres es el paso que sobra.
  const yo = staff.find((person) => person.id === me);
  const otros = staff.filter((person) => person.id !== me);
  const lista = yo ? [yo, ...otros] : otros;

  const guardar = () => {
    setError(null);

    startTransition(async () => {
      let ultimo: FormState = IDLE;

      if (waiter !== waiterId) {
        ultimo = await setSessionWaiter(sessionId, waiter);

        if (ultimo.status === "error") {
          setError(ultimo.message ?? "No se pudo asignar la mesa.");
          return;
        }
      }

      const limpia = etiqueta.trim();

      if (limpia !== (tag ?? "") || (limpia && color !== tagColorKey)) {
        ultimo = await setSessionTag(sessionId, limpia, limpia ? color : "");

        if (ultimo.status === "error") {
          setError(ultimo.message ?? "No se pudo guardar la etiqueta.");
          return;
        }
      }

      onDone(ultimo);
    });
  };

  return (
    <div className="fixed inset-0 z-60 flex h-[100dvh] items-end bg-ink/80 backdrop-blur-sm">
      <div className="max-h-full w-full overflow-y-auto overscroll-contain border-t border-line bg-ink-soft p-5 pb-safe">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted">
              Mesa {tableNumber}
            </p>
            <h2 className="truncate font-display text-xl text-bone">
              Quién atiende
            </h2>
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
          {lista.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => setWaiter(person.id)}
              aria-pressed={waiter === person.id}
              className={[
                "h-11 border px-3 text-sm transition-colors",
                waiter === person.id
                  ? "border-crimson bg-crimson/15 text-bone"
                  : "border-line text-bone-dim",
              ].join(" ")}
            >
              {person.id === me ? `${person.name} (yo)` : person.name}
            </button>
          ))}

          {/* La mesa puede quedar sin dueño: el que la atendia se fue y
              todavia no la tomo nadie. Decirlo es mejor que dejar un nombre
              que ya no esta en el local. */}
          <button
            type="button"
            onClick={() => setWaiter(null)}
            aria-pressed={waiter === null}
            className={[
              "h-11 border px-3 text-sm transition-colors",
              waiter === null
                ? "border-crimson bg-crimson/15 text-bone"
                : "border-line text-muted",
            ].join(" ")}
          >
            Sin garzón
          </button>
        </div>

        <h3 className="mt-6 font-display text-lg text-bone">Etiqueta</h3>
        <p className="mt-1 text-xs text-muted">
          Se ve en la casilla de la mesa, desde el otro lado del salón.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {TAG_PRESETS.map((preset) => {
            const activa =
              etiqueta.trim().toLowerCase() === preset.label.toLowerCase();

            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  // Tocar la etiqueta que ya estaba puesta la saca: es como se
                  // desmarca una mesa sin tener que borrar letra por letra.
                  if (activa) {
                    setEtiqueta("");
                    return;
                  }

                  setEtiqueta(preset.label);
                  setColor(preset.color);
                }}
                aria-pressed={activa}
                className={[
                  "h-11 border px-3 text-sm transition-colors",
                  activa
                    ? TAG_COLORS[preset.color].chip
                    : "border-line text-bone-dim",
                ].join(" ")}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <label className="mt-4 block">
          <span className="text-[0.6rem] uppercase tracking-[0.2em] text-muted">
            O escribe otra
          </span>
          <input
            value={etiqueta}
            onChange={(event) => setEtiqueta(event.target.value)}
            maxLength={24}
            placeholder="Sale a las 22"
            className="mt-2 w-full border border-line bg-ink px-3 py-2 text-bone placeholder:text-muted focus:border-crimson focus:outline-none"
          />
        </label>

        {/* El color solo tiene sentido si hay algo que pintar. */}
        {etiqueta.trim() !== "" && (
          <div className="mt-4">
            <span className="text-[0.6rem] uppercase tracking-[0.2em] text-muted">
              Color
            </span>

            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(TAG_COLORS) as TagColor[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setColor(key)}
                  aria-pressed={color === key}
                  className={[
                    "h-11 border px-3 text-sm transition-colors",
                    TAG_COLORS[key].chip,
                    color === key ? "ring-1 ring-bone/40" : "opacity-60",
                  ].join(" ")}
                >
                  {TAG_COLORS[key].label}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-crimson-bright">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={guardar}
          disabled={pending}
          className="mt-6 flex h-14 w-full items-center justify-center gap-2 border border-crimson bg-crimson/15 text-sm text-bone disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            "Listo"
          )}
        </button>
      </div>
    </div>
  );
}
