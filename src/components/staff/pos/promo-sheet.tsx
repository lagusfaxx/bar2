"use client";

import { Check, Gift, Loader2, Lock, X } from "lucide-react";
import { useState, useTransition } from "react";

import { applyPromotion } from "@/app/actions/pos";
import { OptionSheet } from "@/components/staff/pos/option-sheet";
import { formatPrice } from "@/lib/format";
import { IDLE, type FormState } from "@/lib/form-state";
import type { PromotionOffer } from "@/lib/pos";

/**
 * Los beneficios que esta mesa puede usar.
 *
 * La lista viene resuelta del servidor: cada fila ya sabe cuanta plata
 * descuenta en ESTA cuenta y, si no se puede usar, por que no. La garzona no
 * calcula nada ni interpreta condiciones —toca una fila y el descuento entra—.
 *
 * Las que no se pueden usar igual se muestran, apagadas y con el motivo. Es
 * deliberado: "necesita 2 x Schop en la cuenta" es una venta esperando que
 * alguien la lea, y esconderla obliga a la garzona a explicar de memoria por
 * que el cliente no ve su promo.
 */
export function PromoSheet({
  sessionId,
  dinerId,
  tabLabel,
  offers,
  onClose,
}: {
  sessionId: string;
  /** null = a la cuenta compartida de la mesa. */
  dinerId: string | null;
  tabLabel: string;
  offers: PromotionOffer[];
  onClose: () => void;
}) {
  const [state, setState] = useState<FormState>(IDLE);
  const [pending, startTransition] = useTransition();
  const [applying, setApplying] = useState<string | null>(null);

  /** La cortesia que antes de regalarse pregunta algo. Ver `OptionSheet`. */
  const [preguntando, setPreguntando] = useState<PromotionOffer | null>(null);

  const apply = (offer: PromotionOffer, option?: string) => {
    const formData = new FormData();
    formData.set("sessionId", sessionId);
    formData.set("promotionId", offer.id);
    if (dinerId) formData.set("dinerId", dinerId);
    if (option) formData.set("variant", option);

    setApplying(offer.id);

    startTransition(async () => {
      const result = await applyPromotion(IDLE, formData);
      setState(result);
      setApplying(null);

      if (result.status === "success") onClose();
    });
  };

  /**
   * Un toque en un beneficio.
   *
   * Igual que en la carta: el camino corto sigue siendo un toque, y la pregunta
   * aparece solo cuando la cortesia va a agregar un producto que la necesita.
   * Sin esto, aplicar una promo de bebida fallaba con "elige el sabor" y no
   * habia donde elegirlo.
   */
  const elegir = (offer: PromotionOffer) => {
    if (offer.options.length > 0) {
      setPreguntando(offer);
      return;
    }

    apply(offer);
  };

  const disponibles = offers.filter((offer) => offer.available);
  const resto = offers.filter((offer) => !offer.available);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Beneficios BarzuCard"
      className="fixed inset-0 z-50 flex h-[100dvh] items-end bg-ink/80 backdrop-blur-sm"
    >
      <div className="max-h-full w-full overflow-y-auto overscroll-contain border-t border-line bg-ink-soft p-5 pb-safe">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted">Se aplica a {tabLabel}</p>
            <h2 className="font-display text-xl text-bone">
              Beneficios BarzuCard
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-11 items-center justify-center border border-line text-bone"
            aria-label="Cerrar"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {offers.length === 0 && (
          <p className="mt-6 border border-line p-5 text-sm text-muted">
            No hay promociones activas en este momento.
          </p>
        )}

        {disponibles.length > 0 && (
          <ul className="mt-5 flex flex-col gap-2">
            {disponibles.map((offer) => (
              <li key={offer.id}>
                <button
                  type="button"
                  onClick={() => elegir(offer)}
                  disabled={pending}
                  className="flex w-full items-center justify-between gap-4 border border-line bg-ink p-4 text-left transition-colors hover:border-crimson disabled:opacity-60"
                >
                  <span className="min-w-0">
                    <span className="block font-display text-lg leading-tight text-bone">
                      {offer.title}
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {offer.typeLabel}
                      {offer.targetName && ` · ${offer.targetName}`}
                      {offer.detail && ` · ${offer.detail}`}
                    </span>
                  </span>

                  <span className="shrink-0 text-right">
                    {applying === offer.id ? (
                      <Loader2 className="size-5 animate-spin text-crimson" aria-hidden />
                    ) : offer.addsProduct ? (
                      <span className="flex items-center gap-1 font-display text-base text-gilt-soft">
                        <Gift className="size-4" aria-hidden />
                        Cortesía
                      </span>
                    ) : (
                      <span className="font-display text-xl text-emerald-300">
                        −{formatPrice(offer.previewCents)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {resto.length > 0 && (
          <>
            <p className="mt-6 text-[0.68rem] font-medium tracking-[0.18em] text-muted uppercase">
              Todavía no
            </p>

            <ul className="mt-2 flex flex-col gap-2">
              {resto.map((offer) => (
                <li
                  key={offer.id}
                  className="flex items-center justify-between gap-4 border border-line/60 p-4"
                >
                  <span className="min-w-0">
                    <span className="block text-base leading-tight text-bone-dim">
                      {offer.title}
                    </span>
                    <span className="mt-1 block text-xs text-muted-dark">
                      {offer.reason}
                    </span>
                  </span>

                  {offer.applied ? (
                    <Check className="size-5 shrink-0 text-emerald-400" aria-hidden />
                  ) : (
                    <Lock className="size-4 shrink-0 text-muted-dark" aria-hidden />
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        {state.status === "error" && (
          <p role="alert" className="mt-4 text-sm text-crimson-bright">
            {state.message}
          </p>
        )}
      </div>

      {/*
        La misma hoja que en la carta, a proposito.

        Elegir el sabor de una bebida que se regala y de una que se vende es el
        mismo gesto, y no hay razon para que se vean distinto: se arma un
        producto con lo que la oferta trae —la cortesia siempre es una unidad,
        asi que el precio no pinta nada aca— y se reusa tal cual.
      */}
      {preguntando && (
        <OptionSheet
          product={{
            id: preguntando.id,
            name: preguntando.targetName ?? preguntando.title,
            station: "BARRA",
            unitPriceCents: 0,
            discountCents: 0,
            discountLabel: null,
            optionLabel: preguntando.optionLabel ?? "Elige",
            options: preguntando.options,
          }}
          dinerLabel={tabLabel}
          pending={pending}
          onPick={(option) => apply(preguntando, option)}
          onClose={() => setPreguntando(null)}
        />
      )}
    </div>
  );
}
