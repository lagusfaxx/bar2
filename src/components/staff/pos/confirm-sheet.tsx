"use client";

import { Loader2 } from "lucide-react";
import { useTransition } from "react";

/**
 * Confirmacion de una accion que no se puede deshacer.
 *
 * En sala se toca rapido, con una mano, caminando y a media luz. Anular un
 * producto que la cocina ya esta preparando, borrar a un comensal con su
 * consumo o cerrar una mesa eran hasta ahora un solo toque sin vuelta atras,
 * y los tres botones estaban a centimetros de otros que se usan todo el rato.
 *
 * No se usa el `confirm()` del navegador a proposito: en el telefono abre un
 * cuadro del sistema que muestra la direccion de la pagina y aparece pegado
 * arriba, lejos del pulgar. Esta hoja sube desde abajo, dice en una frase que
 * va a pasar y pone el boton peligroso lejos del borde por donde se vuelve.
 */
export function ConfirmSheet({
  title,
  detail,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  /** Que se va a hacer, en una linea. */
  title: string;
  /** La consecuencia, dicha sin rodeos. */
  detail: string;
  confirmLabel: string;
  onConfirm: () => Promise<unknown> | void;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-60 flex h-[100dvh] items-end bg-ink/80"
    >
      <div className="w-full border-t border-line bg-ink-soft p-5 pb-safe">
        <h2 className="font-display text-xl text-bone">{title}</h2>
        <p className="mt-2 text-sm text-muted">{detail}</p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(async () => {
              await onConfirm();
              onClose();
            })}
            className="flex h-14 w-full items-center justify-center gap-2 bg-crimson text-base font-medium text-bone disabled:opacity-60"
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {confirmLabel}
          </button>

          {/* Volver atras es lo que mas se va a tocar y es lo que no rompe
              nada: va abajo, que es donde cae el pulgar sin estirarse. */}
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="h-14 w-full border border-line text-base text-bone-dim"
          >
            No, volver
          </button>
        </div>
      </div>
    </div>
  );
}
