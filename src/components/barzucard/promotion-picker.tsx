"use client";

import { QrCode } from "lucide-react";
import { useActionState } from "react";

import { requestVoucher } from "@/app/actions/barzucard";
import { PromotionCard } from "@/components/barzucard/promotion-card";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { IDLE } from "@/lib/form-state";

type Promotion = React.ComponentProps<typeof PromotionCard>["promotion"];

/**
 * Una promocion con su boton para pedir el cupon.
 *
 * Es el paso que faltaba en la interaccion: el socio elige el descuento acá y
 * se lleva un QR de ese descuento en concreto, en vez de mostrar la tarjeta y
 * esperar a que el equipo de sala adivine qué quería canjear.
 */
export function PromotionPicker({ promotion }: { promotion: Promotion }) {
  const [state, action] = useActionState(requestVoucher, IDLE);

  return (
    <form action={action} className="flex h-full flex-col gap-3">
      <input type="hidden" name="promotionId" value={promotion.id} />

      <PromotionCard promotion={promotion} className="flex-1" />

      <FormMessage state={state} />

      <SubmitButton className="w-full" pendingLabel="Generando cupón…">
        <QrCode className="size-4" aria-hidden />
        Quiero este descuento
      </SubmitButton>
    </form>
  );
}
