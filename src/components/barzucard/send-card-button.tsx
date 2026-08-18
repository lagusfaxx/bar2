"use client";

import { Check, Loader2, Mail } from "lucide-react";
import { useState, useTransition } from "react";

import { sendMyCard } from "@/app/actions/member";
import { IDLE, type FormState } from "@/lib/form-state";

/**
 * Mandarse la tarjeta al correo.
 *
 * Es el respaldo de todos los demas: la imagen se puede borrar de la galeria y
 * el papel se pierde, pero el correo se busca. Va al correo con el que el socio
 * se registro y no a uno que se escriba aca — si no, bastaria un minuto con la
 * sesion ajena abierta para mandarse la tarjeta de otro a la casilla propia.
 */
export function SendCardButton() {
  const [state, setState] = useState<FormState>(IDLE);
  const [pending, startTransition] = useTransition();

  const enviar = () => {
    startTransition(async () => setState(await sendMyCard()));
  };

  return (
    <>
      <button
        type="button"
        disabled={pending || state.status === "success"}
        onClick={enviar}
        className="inline-flex h-12 items-center justify-center gap-2 border border-line px-5 text-sm text-bone-dim transition-colors hover:border-crimson hover:text-bone disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : state.status === "success" ? (
          <Check className="size-4 text-emerald-400" aria-hidden />
        ) : (
          <Mail className="size-4" aria-hidden />
        )}
        {state.status === "success" ? "Enviada" : "Recibir por correo"}
      </button>

      {state.message && (
        <p
          role="status"
          className={[
            "sm:col-span-2 text-sm",
            state.status === "error" ? "text-crimson-bright" : "text-emerald-300",
          ].join(" ")}
        >
          {state.message}
        </p>
      )}
    </>
  );
}
