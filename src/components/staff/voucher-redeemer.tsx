"use client";

import { AlertCircle, Check, Loader2, Star } from "lucide-react";
import { useState, useTransition } from "react";

import { redeemVoucher } from "@/app/actions/admin/loyalty";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/section";
import { formatCardNumber, promotionValueLabel, TIER_LABELS } from "@/lib/format";
import { IDLE, type FormState } from "@/lib/form-state";
import type { VoucherLookup } from "@/lib/vouchers";

/**
 * Confirmacion de un cupon que el socio ya eligio.
 *
 * A diferencia de la busqueda por tarjeta, aca no hay nada que elegir: el QR ya
 * dice que descuento es. La pantalla se limita a mostrar quien es el socio, que
 * pidio y un unico boton.
 */
export function VoucherRedeemer({ voucher }: { voucher: VoucherLookup }) {
  const [state, setState] = useState<FormState>(IDLE);
  const [pending, startTransition] = useTransition();

  /**
   * Momento en que se pidio confirmacion. Se guarda el instante y no un
   * booleano para descartar el mismo toque que abrio la confirmacion: el boton
   * aparece justo bajo el dedo.
   */
  const [confirmingSince, setConfirmingSince] = useState<number | null>(null);
  const confirming = confirmingSince !== null;

  const [receipt, setReceipt] = useState<string | null>(
    voucher.receiptCode ?? null,
  );

  const action = (formData: FormData) => {
    if (confirmingSince !== null && Date.now() - confirmingSince < 500) return;

    startTransition(async () => {
      const result = await redeemVoucher(IDLE, formData);
      setState(result);

      if (result.status === "success") {
        setReceipt(String(result.data?.receiptCode ?? ""));
        setConfirmingSince(null);
      }
    });
  };

  const blocked = !!voucher.blockedReason;

  return (
    <div className="flex flex-col gap-5">
      {/* Comprobante: queda a la vista para mostrárselo al cliente. */}
      {receipt && (
        <div
          role="status"
          className="border border-emerald-500/50 bg-emerald-500/10 p-5"
        >
          <p className="flex items-center gap-2 font-display text-xl text-emerald-200">
            <Check className="size-5" aria-hidden />
            Canje confirmado
          </p>
          <p className="mt-1 text-sm text-emerald-200/80">
            {voucher.promotion.title}
          </p>
          <p className="mt-3 font-mono text-sm tracking-[0.18em] text-emerald-300">
            {receipt}
          </p>
        </div>
      )}

      {/* Qué pidió el socio */}
      <div className="border border-crimson/40 bg-crimson/8 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="eyebrow text-crimson-bright">El socio eligió</p>
            <p className="mt-2 font-display text-2xl leading-tight text-bone">
              {voucher.promotion.title}
            </p>
            <p className="mt-1.5 text-sm text-muted">
              {voucher.promotion.description}
            </p>
          </div>

          <Badge tone="crimson" className="shrink-0">
            {promotionValueLabel(voucher.promotion.type, voucher.promotion.value)}
          </Badge>
        </div>

        {(voucher.promotion.pointsCost > 0 ||
          voucher.promotion.pointsReward > 0) && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-gilt-soft">
            <Star className="size-3" aria-hidden />
            {voucher.promotion.pointsCost > 0 &&
              `Cuesta ${voucher.promotion.pointsCost} pts`}
            {voucher.promotion.pointsCost > 0 &&
              voucher.promotion.pointsReward > 0 &&
              " · "}
            {voucher.promotion.pointsReward > 0 &&
              `Suma ${voucher.promotion.pointsReward} pts`}
          </p>
        )}

        {voucher.promotion.terms && (
          <p className="mt-3 border-t border-crimson/25 pt-3 text-xs leading-relaxed text-muted">
            {voucher.promotion.terms}
          </p>
        )}
      </div>

      {/* Quién es */}
      <div className="border border-line bg-ink-soft p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-xl text-bone">
              {voucher.member.fullName}
            </p>
            <p className="mt-1 font-mono text-xs tracking-[0.14em] text-muted">
              {formatCardNumber(voucher.card.cardNumber)}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge tone={voucher.card.tier === "CLASICA" ? "muted" : "gilt"}>
              {TIER_LABELS[voucher.card.tier]}
            </Badge>
            <span className="flex items-center gap-1.5 text-sm text-gilt-soft">
              <Star className="size-3.5" aria-hidden />
              {voucher.card.points} pts
            </span>
          </div>
        </div>

        <p className="mt-4 font-mono text-xs tracking-[0.2em] text-muted-dark">
          {voucher.code}
        </p>
      </div>

      {state.status === "error" && state.message && (
        <p
          role="alert"
          className="flex items-start gap-2 border border-crimson/50 bg-crimson/10 px-4 py-3 text-sm text-crimson-bright"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.message}
        </p>
      )}

      {blocked && !receipt ? (
        <p className="flex items-start gap-2 border border-crimson/50 bg-crimson/10 px-4 py-4 text-sm text-crimson-bright">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {voucher.blockedReason}
        </p>
      ) : receipt ? null : (
        <form action={action}>
          <input type="hidden" name="token" value={voucher.token} />

          <div className="flex gap-2">
            {confirming ? (
              <>
                {/* "Cancelar" queda donde estaba "Aplicar": si el dedo sigue
                    apoyado ahí, lo peor que pasa es cerrar el paso. */}
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={() => setConfirmingSince(null)}
                >
                  Cancelar
                </Button>

                <Button type="submit" size="lg" disabled={pending} className="flex-1">
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="size-4" aria-hidden />
                  )}
                  {pending ? "Registrando…" : "Confirmar canje"}
                </Button>
              </>
            ) : (
              // Doble toque a propósito: evita canjes accidentales en la barra.
              <Button
                type="button"
                size="lg"
                className="w-full"
                onClick={() => setConfirmingSince(Date.now())}
              >
                Aplicar descuento
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
