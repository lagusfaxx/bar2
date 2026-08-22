"use client";

import { Ban } from "lucide-react";
import { useActionState, useState } from "react";

import { voidPayment } from "@/app/actions/admin/caja";
import { SubmitButton } from "@/components/ui/form";
import { IDLE } from "@/lib/form-state";

/**
 * Anular un cobro desde el cierre del dia.
 *
 * Pide el motivo y no lo da por opcional: sin el, un mes despues nadie sabe si
 * ese cobro anulado fue una prueba del POS o la devolucion de un cliente, que
 * es justamente por lo que se anula en vez de borrarse.
 *
 * El cuadro esta cerrado hasta que se toca "Anular". Con treinta cobros en la
 * tabla, treinta cajas de texto abiertas no dejan leer lo unico que se viene a
 * leer aca, que es cuanto se vendio.
 */
export function PaymentVoid({
  paymentId,
  code,
  total,
}: {
  paymentId: string;
  code: string;
  /** Ya formateado: el aviso lo dice en plata, que es como se decide. */
  total: string;
}) {
  const [state, action] = useActionState(voidPayment, IDLE);
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title={`Anular el cobro ${code}`}
        className="flex h-9 items-center gap-1.5 border border-line px-2.5 text-xs text-muted transition-colors hover:border-crimson hover:text-crimson-bright"
      >
        <Ban className="size-3.5" aria-hidden />
        Anular
      </button>
    );
  }

  /* Anulado, el boton ya no tiene nada que hacer: lo que queda es el aviso, y
     la fila se va a la lista de anulados en cuanto la pagina se recargue. */
  if (state.status === "success") {
    return (
      <p role="status" className="text-xs text-emerald-300">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="paymentId" value={paymentId} />

      <p className="text-xs text-muted">
        Anular {code} · {total}. Sale de las cifras del día y queda registrado
        con tu nombre.
      </p>

      <input
        type="text"
        name="reason"
        required
        maxLength={140}
        autoFocus
        placeholder="Motivo: prueba del POS, mesa equivocada…"
        aria-label="Motivo de la anulación"
        className="h-10 w-56 border border-line bg-ink px-3 text-sm text-bone placeholder:text-muted-dark focus:border-crimson focus:outline-none"
      />

      {state.status === "error" && state.message && (
        <p role="alert" className="text-xs text-crimson-bright">
          {state.message}
        </p>
      )}

      <div className="flex gap-2">
        <SubmitButton className="h-9 text-xs" pendingLabel="Anulando…">
          Anular cobro
        </SubmitButton>

        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="h-9 border border-line px-3 text-xs text-muted transition-colors hover:text-bone"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
