"use client";

import { Check, CreditCard, Loader2, X } from "lucide-react";
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
  onClose,
}: {
  sessionId: string;
  /** null = se cobra todo lo pendiente de la mesa. */
  tab: AccountTab | null;
  totalCents: number;
  onClose: () => void;
}) {
  const [state, setState] = useState<FormState>(IDLE);
  const [pending, startTransition] = useTransition();
  const [method, setMethod] = useState<string>("EFECTIVO");
  const [cardNumber, setCardNumber] = useState("");

  const receipt =
    state.status === "success" ? String(state.data?.code ?? "") : null;
  const points = state.status === "success" ? Number(state.data?.points ?? 0) : 0;

  const submit = () => {
    const formData = new FormData();
    formData.set("sessionId", sessionId);
    formData.set("method", method);
    if (tab?.dinerId) formData.set("dinerId", tab.dinerId);
    if (cardNumber.trim()) formData.set("cardNumber", cardNumber.trim());

    startTransition(async () => {
      setState(await payAccount(IDLE, formData));
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/80 backdrop-blur-sm">
      <div className="max-h-[92svh] w-full overflow-y-auto border-t border-line bg-ink-soft p-5">
        {receipt ? (
          <div className="py-4 text-center">
            <p className="flex items-center justify-center gap-2 font-display text-2xl text-emerald-200">
              <Check className="size-6" aria-hidden />
              Cobrado
            </p>
            <p className="mt-3 font-display text-4xl text-bone">
              {formatPrice(totalCents)}
            </p>
            <p className="mt-2 text-sm text-muted">Comprobante {receipt}</p>

            {points > 0 && (
              <p className="mt-3 text-sm text-gilt-soft">
                +{points} puntos a su BarzuCard
              </p>
            )}

            <button
              type="button"
              onClick={onClose}
              className="mt-6 h-14 w-full bg-crimson font-medium uppercase tracking-[0.18em] text-bone"
            >
              Volver a la mesa
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted">
                  Cobrando
                </p>
                <h2 className="font-display text-xl text-bone">
                  {tab ? tab.label : "Mesa completa"}
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

            <fieldset className="mt-5">
              <legend className="text-[0.6rem] uppercase tracking-[0.2em] text-muted">
                Forma de pago
              </legend>

              <div className="mt-2 grid grid-cols-2 gap-2">
                {METHODS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMethod(option.value)}
                    aria-pressed={method === option.value}
                    className={[
                      "h-12 border text-sm transition-colors",
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

            <label className="mt-5 block">
              <span className="flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.2em] text-muted">
                <CreditCard className="size-3.5" aria-hidden />
                BarzuCard (opcional)
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={cardNumber}
                onChange={(event) => setCardNumber(event.target.value)}
                placeholder="16 dígitos de la tarjeta"
                className="mt-2 h-12 w-full border border-line bg-ink px-3 text-bone placeholder:text-muted focus:border-crimson focus:outline-none"
              />
              <span className="mt-1 block text-xs text-muted">
                Suma 1 punto por cada $1.000 de consumo.
              </span>
            </label>

            {state.status === "error" && (
              <p role="alert" className="mt-4 text-sm text-crimson-bright">
                {state.message}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="mt-6 flex h-16 w-full items-center justify-center gap-2 bg-crimson font-medium uppercase tracking-[0.18em] text-bone disabled:opacity-60"
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
