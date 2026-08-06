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
export function PromotionPicker({
  promotion,
  compact = false,
}: {
  promotion: Promotion;
  /** Fila sin imagen, para la pantalla del socio. */
  compact?: boolean;
}) {
  const [state, action] = useActionState(requestVoucher, IDLE);

  /*
   * En la version compacta el boton va DENTRO de la caja del beneficio.
   * Suelto debajo, como estaba, se leia como un boton de la pagina y no de esa
   * promocion — sobre todo en escritorio, donde las cajas van de a dos y los
   * botones quedaban en una fila propia.
   */
  return (
    <form
      action={action}
      className={
        compact
          ? "flex h-full flex-col gap-3 border border-line bg-ink-soft p-5"
          : "flex h-full flex-col gap-3"
      }
    >
      <input type="hidden" name="promotionId" value={promotion.id} />

      <PromotionCard
        promotion={promotion}
        compact={compact}
        className={compact ? "flex-1 border-0 bg-transparent p-0" : "flex-1"}
      />

      <FormMessage state={state} />

      {/* En la lista del socio hay cinco de estos seguidos: en rojo lleno
          eran cinco barras gritando lo mismo. El contorno se sigue leyendo
          como boton sin convertir la pantalla en un semaforo. */}
      <SubmitButton
        className="w-full"
        variant={compact ? "outline" : "primary"}
        size={compact ? "sm" : "md"}
        pendingLabel="Generando cupón…"
      >
        <QrCode className="size-3.5" aria-hidden />
        Quiero este descuento
      </SubmitButton>
    </form>
  );
}
