"use client";

import { Check, Loader2, X } from "lucide-react";
import { useState, useTransition } from "react";

import { moveItem } from "@/app/actions/pos";
import type { FormState } from "@/lib/form-state";
import type { AccountItem, AccountTab } from "@/lib/pos";

/**
 * De quien es este producto.
 *
 * Separar la cuenta no sirve de nada si lo consumido no queda repartido: el
 * garzon carga la ronda entera sobre la pestana que tiene abierta —casi
 * siempre la de la mesa, que es la que aparece al entrar— y recien al pagar
 * alguien dice "yo pago lo mio". Hasta ahora eso no tenia arreglo desde la
 * pantalla: las pestanas de Victor y Daniel quedaban en cero, "Solo Victor"
 * salia apagado y la unica salida era cobrar la mesa entera, que imprime el
 * resumen completo y deja todo pagado de una.
 *
 * La reasignacion vive en la linea y no en un modo aparte: se toca el producto
 * que se quiere mover y se elige a quien pasa. Es el mismo gesto que hace el
 * cliente al señalar su trago.
 */
export function AssignSheet({
  item,
  tabs,
  onDone,
  onClose,
}: {
  item: AccountItem;
  /** Las pestanas de la cuenta: la de la mesa primero, despues los comensales. */
  tabs: AccountTab[];
  onDone: (result: FormState) => void;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  /** Cual se esta moviendo: la espera va en el boton que se toco. */
  const [moviendo, setMoviendo] = useState<string | null>(null);

  const asignar = (dinerId: string | null) => {
    // Tocar donde ya esta no es un error: se cierra y no se toca la base.
    if (dinerId === item.dinerId) {
      onClose();
      return;
    }

    setMoviendo(dinerId ?? "mesa");

    startTransition(async () => {
      const result = await moveItem(item.id, dinerId);
      onDone(result);
      onClose();
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`¿De quién es ${item.name}?`}
      className="fixed inset-0 z-60 flex h-[100dvh] items-end bg-ink/80 backdrop-blur-sm"
    >
      <div className="max-h-full w-full overflow-y-auto overscroll-contain border-t border-line bg-ink-soft p-5 pb-safe">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted">¿De quién es?</p>
            <h2 className="truncate font-display text-xl text-bone">
              {item.quantity}× {item.name}
              {item.variant && (
                <span className="text-gilt-soft"> · {item.variant}</span>
              )}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-11 shrink-0 items-center justify-center border border-line text-bone"
            aria-label="Volver sin mover"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          {tabs.map((tab) => {
            const aqui = tab.dinerId === item.dinerId;
            const clave = tab.dinerId ?? "mesa";

            return (
              <button
                key={clave}
                type="button"
                disabled={pending}
                onClick={() => asignar(tab.dinerId)}
                className={[
                  "flex min-h-16 w-full items-center justify-between gap-3 border px-4 text-left transition-colors disabled:opacity-60",
                  aqui ? "border-crimson bg-crimson/12" : "border-line bg-ink",
                ].join(" ")}
              >
                <span className="font-display text-lg text-bone">
                  {tab.label}
                </span>

                {moviendo === clave ? (
                  <Loader2 className="size-5 shrink-0 animate-spin text-muted" aria-hidden />
                ) : (
                  aqui && (
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                      <Check className="size-4" aria-hidden />
                      Está acá
                    </span>
                  )
                )}
              </button>
            );
          })}
        </div>

        {/* Lo que mueve y lo que no: nadie tiene que adivinar si la cocina se
            entera de esto. */}
        <p className="mt-4 text-center text-xs text-muted">
          Solo cambia a quién se le cobra. Lo pedido no se toca.
        </p>
      </div>
    </div>
  );
}
