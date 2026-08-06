"use client";

import { Check, Gift, Loader2, X } from "lucide-react";
import { useState, useTransition } from "react";

import { payAccount } from "@/app/actions/pos";
import { formatPrice } from "@/lib/format";
import { IDLE, type FormState } from "@/lib/form-state";
import type { AccountTab } from "@/lib/pos";

const METHODS = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "DEBITO", label: "Débito" },
  { value: "CREDITO", label: "Crédito" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
] as const;

/**
 * Cobro de una cuenta.
 *
 * Sirve para las dos formas que se dan en un bar: la pestana de un comensal
 * (`tab`) o la mesa entera (`tab` en null). Cobrar a uno no cierra la mesa:
 * los demas siguen consumiendo y quien pago puede volver a pedir.
 *
 * No hay campo de propina a proposito: la deja el cliente en la terminal.
 */
export function PaySheet({
  sessionId,
  tab,
  totalCents,
  discountCents,
  onClose,
}: {
  sessionId: string;
  /** null = se cobra todo lo pendiente de la mesa. */
  tab: AccountTab | null;
  /** Lo que hay que cobrar, ya con los beneficios descontados. */
  totalCents: number;
  /** Lo que descontó la BarzuCard, para mostrarlo desglosado. */
  discountCents: number;
  onClose: () => void;
}) {
  const [state, setState] = useState<FormState>(IDLE);
  const [pending, startTransition] = useTransition();
  const [method, setMethod] = useState<string>("EFECTIVO");

  const receipt =
    state.status === "success" ? String(state.data?.code ?? "") : null;

  /*
   * Cuanto se cobro, segun el servidor.
   *
   * La pantalla de exito mostraba `totalCents`, que es el saldo que le queda a
   * la mesa. Pero justo antes de mostrarla ese saldo se acaba de pagar: la
   * ruta se revalida, la propiedad baja a cero y el garzon leia "Cobrado $0"
   * despues de cobrar trece mil pesos — con el cliente mirando la pantalla.
   * El monto real viene en la respuesta del cobro y ya no cambia.
   */
  const chargedCents =
    state.status === "success"
      ? Number(state.data?.totalCents ?? totalCents)
      : totalCents;

  const submit = () => {
    const formData = new FormData();
    formData.set("sessionId", sessionId);
    formData.set("method", method);
    if (tab?.dinerId) formData.set("dinerId", tab.dinerId);

    startTransition(async () => {
      setState(await payAccount(IDLE, formData));
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] items-end bg-ink/80 backdrop-blur-sm">
      <div className="max-h-full w-full overflow-y-auto overscroll-contain border-t border-line bg-ink-soft p-5 pb-safe">
        {receipt ? (
          <div className="py-4 text-center">
            <p className="flex items-center justify-center gap-2 font-display text-2xl text-emerald-200">
              <Check className="size-6" aria-hidden />
              Cobrado
            </p>
            <p className="mt-3 font-display text-4xl text-bone">
              {formatPrice(chargedCents)}
            </p>
            <p className="mt-2 text-sm text-muted">
              N° de comprobante: {receipt}
            </p>

            {discountCents > 0 && (
              <p className="mt-3 text-sm text-emerald-300">
                La BarzuCard le descontó {formatPrice(discountCents)}
              </p>
            )}

            <button
              type="button"
              onClick={onClose}
              className="mt-6 h-14 w-full bg-crimson text-base font-medium text-bone"
            >
              Volver a la mesa
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted">Le vas a cobrar a</p>
                <h2 className="font-display text-xl text-bone">
                  {tab ? tab.label : "Toda la mesa"}
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex size-11 items-center justify-center border border-line text-bone"
                aria-label="Cancelar"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <p className="mt-4 font-display text-5xl text-bone">
              {formatPrice(totalCents)}
            </p>

            {discountCents > 0 && (
              <p className="text-sm text-muted">
                Ya con {formatPrice(discountCents)} de descuento
              </p>
            )}

            <fieldset className="mt-5">
              <legend className="text-sm text-bone">¿Cómo paga?</legend>

              <div className="mt-2 grid grid-cols-2 gap-2">
                {METHODS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMethod(option.value)}
                    aria-pressed={method === option.value}
                    className={[
                      "h-14 border text-base transition-colors",
                      method === option.value
                        ? "border-crimson bg-crimson/15 text-bone"
                        : "border-line text-bone-dim",
                    ].join(" ")}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Los beneficios ya estan aplicados en la cuenta: aca solo se
                muestran, para poder decirle al cliente cuanto se le rebajo. */}
            {discountCents > 0 && (
              <p className="mt-4 flex items-center justify-between gap-3 border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-sm">
                <span className="flex items-center gap-2 text-bone-dim">
                  <Gift className="size-4 text-emerald-300" aria-hidden />
                  Beneficios BarzuCard
                </span>
                <span className="font-display text-emerald-300">
                  −{formatPrice(discountCents)}
                </span>
              </p>
            )}

            {state.status === "error" && (
              <p role="alert" className="mt-4 text-sm text-crimson-bright">
                {state.message}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="mt-6 flex h-16 w-full items-center justify-center gap-2 bg-crimson text-lg font-medium text-bone disabled:opacity-60"
            >
              {pending ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                `Cobrar ${formatPrice(totalCents)}`
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
