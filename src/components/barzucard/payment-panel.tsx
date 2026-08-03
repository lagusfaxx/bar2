"use client";

import { BadgeCheck, Clock, CreditCard, Store } from "lucide-react";
import { useActionState } from "react";

import { reportCardTransfer } from "@/app/actions/public";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { IDLE } from "@/lib/form-state";

type PaymentPanelProps = {
  status: "PENDING" | "REPORTED" | "PAID" | "DELIVERED";
  price: string;
  paymentInfo: string | null;
  pickupInfo: string | null;
  reference: string | null;
};

/**
 * Estado del pago de la tarjeta fisica, con los pasos siempre a la vista.
 *
 * El socio ve en que punto esta (pendiente, informada, confirmada, entregada),
 * los datos para transferir y un formulario para avisar que ya pago. La
 * confirmacion la hace el local desde el panel: avisar no acredita nada.
 */
export function PaymentPanel({
  status,
  price,
  paymentInfo,
  pickupInfo,
  reference,
}: PaymentPanelProps) {
  const [state, action] = useActionState(reportCardTransfer, IDLE);

  if (status === "DELIVERED") {
    return (
      <div className="card-bz flex items-start gap-4 p-6">
        <BadgeCheck className="mt-0.5 size-5 shrink-0 text-emerald-300" aria-hidden />
        <div>
          <p className="text-base text-bone">Ya tienes tu tarjeta</p>
          <p className="mt-1 text-sm text-muted">
            La retiraste en el local. Si la pierdes, escríbenos y emitimos un QR
            nuevo.
          </p>
        </div>
      </div>
    );
  }

  if (status === "PAID") {
    return (
      <div className="card-bz flex items-start gap-4 p-6">
        <Store className="mt-0.5 size-5 shrink-0 text-emerald-300" aria-hidden />
        <div>
          <p className="text-base text-bone">Pago confirmado</p>
          <p className="mt-1 text-sm text-muted">
            Tu tarjeta está lista. Pasa a retirarla por el local.
          </p>
          {pickupInfo && (
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-bone-dim">
              {pickupInfo}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card-bz p-6">
      <div className="flex items-start gap-4">
        {status === "REPORTED" ? (
          <Clock className="mt-0.5 size-5 shrink-0 text-gilt-soft" aria-hidden />
        ) : (
          <CreditCard className="mt-0.5 size-5 shrink-0 text-crimson-bright" aria-hidden />
        )}

        <div className="min-w-0">
          <p className="text-base text-bone">
            {status === "REPORTED"
              ? "Estamos revisando tu transferencia"
              : `Tu tarjeta física cuesta ${price}`}
          </p>
          <p className="mt-1 text-sm text-muted">
            {status === "REPORTED"
              ? "Cuando confirmemos el pago te avisamos por correo y podrás pasar a retirarla."
              : "Se paga por transferencia y se retira en el local. Mientras tanto, tu QR ya sirve para canjear beneficios."}
          </p>
        </div>
      </div>

      {status === "REPORTED" && reference && (
        <p className="mt-4 border-t border-line pt-4 text-sm text-muted-dark">
          Dato que nos dejaste: <span className="text-bone-dim">{reference}</span>
        </p>
      )}

      {status !== "REPORTED" && (
        <>
          {paymentInfo && (
            <div className="mt-5 border-t border-line pt-5">
              <p className="eyebrow mb-3 text-muted">Datos para transferir</p>
              <p className="text-sm leading-relaxed whitespace-pre-line text-bone-dim">
                {paymentInfo}
              </p>
            </div>
          )}

          {pickupInfo && (
            <div className="mt-5 border-t border-line pt-5">
              <p className="eyebrow mb-3 text-muted">Cómo la retiras</p>
              <p className="text-sm leading-relaxed whitespace-pre-line text-bone-dim">
                {pickupInfo}
              </p>
            </div>
          )}

          <form action={action} className="mt-5 flex flex-col gap-4 border-t border-line pt-5">
            <Field
              label="Número de operación (opcional)"
              name="paymentReference"
              maxLength={120}
              hint="Si lo tienes a mano, nos ayuda a encontrar tu pago más rápido."
            />
            <FormMessage state={state} />
            <SubmitButton className="self-start" pendingLabel="Enviando…">
              Ya transferí
            </SubmitButton>
          </form>
        </>
      )}
    </div>
  );
}
