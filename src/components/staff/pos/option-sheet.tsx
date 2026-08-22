"use client";

import { X } from "lucide-react";

import type { PosMenuProduct } from "@/lib/pos";

/**
 * Lo que hay que preguntar antes de cargar un producto.
 *
 * Aparece sola, y solo cuando el producto lo pide: la promo que viene con
 * bebida no dice cual, y el agua no dice si es con gas. Sin esto, la unica
 * forma de anotarlo era la nota libre —sacar el teclado con gente esperando— y
 * la barra terminaba recibiendo "coca", "Coca" y "coca cola" para lo mismo.
 *
 * Tres decisiones, y las tres son sobre el tiempo del garzon:
 *
 * 1. **Se elige y se carga, sin confirmar.** Tocar la opcion ES cargar el
 *    producto. Un boton de "aceptar" abajo seria un tercer toque para una
 *    decision que ya se tomo, y de esos toques se hacen las filas en la barra.
 * 2. **Botones del ancho de la pantalla.** Se toca de pie, con una mano, a
 *    veces con el aparato en la otra. Aca no se busca: se lee y se toca.
 * 3. **Se puede salir sin elegir.** El garzon se equivoco de producto, o el
 *    cliente cambio de opinion a mitad de frase. La X no carga nada.
 *
 * No lleva cantidad a proposito: dos Sprite son dos toques a Sprite, igual que
 * dos schops son dos toques al schop en la carta. Es el gesto que el garzon ya
 * tiene aprendido, y agregar un selector de cantidad aca lo obligaria a decidir
 * dos cosas en vez de una.
 */
export function OptionSheet({
  product,
  dinerLabel,
  pending,
  onPick,
  onClose,
}: {
  product: PosMenuProduct;
  /** A quien se le carga: se dice aca porque la hoja tapa la cabecera. */
  dinerLabel: string;
  /** Hay un envio en curso: se bloquean los botones para no cargar dos veces. */
  pending: boolean;
  onPick: (option: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-60 flex h-[100dvh] items-end bg-ink/80 backdrop-blur-sm">
      <div className="max-h-full w-full overflow-y-auto overscroll-contain border-t border-line bg-ink-soft p-5 pb-safe">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.6rem] uppercase tracking-[0.2em] text-gilt-soft">
              {product.optionLabel}
            </p>
            <h2 className="truncate font-display text-xl text-bone">
              {product.name}
            </h2>
            <p className="mt-0.5 truncate text-xs text-muted">
              Se agrega a la cuenta de {dinerLabel}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-11 shrink-0 items-center justify-center border border-line text-bone"
            aria-label="Volver sin agregar"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="mt-5 grid gap-2">
          {product.options.map((option) => (
            <button
              key={option}
              type="button"
              disabled={pending}
              onClick={() => onPick(option)}
              className="flex min-h-16 w-full items-center border border-line bg-ink px-4 text-left font-display text-lg text-bone transition-colors hover:border-crimson active:border-crimson disabled:opacity-60"
            >
              {option}
            </button>
          ))}
        </div>

        {/* Que se puede salir sin cargar nada tiene que estar dicho: la hoja
            aparece sola despues de tocar un producto, y sin esta linea el
            garzon que se equivoco no sabe que la X no le cobra nada. */}
        <p className="mt-4 text-center text-xs text-muted">
          Toca una opción para agregarlo. La X vuelve sin agregar nada.
        </p>
      </div>
    </div>
  );
}
