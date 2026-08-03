"use client";

import { X } from "lucide-react";
import { useActionState } from "react";

import { cancelVoucher } from "@/app/actions/barzucard";
import { FormMessage } from "@/components/ui/form";
import { IDLE } from "@/lib/form-state";

/** Baja del cupon cuando el socio cambia de idea antes de mostrarlo. */
export function VoucherCancel({ code }: { code: string }) {
  const [state, action] = useActionState(cancelVoucher, IDLE);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="code" value={code} />

      <FormMessage state={state} />

      <button
        type="submit"
        className="inline-flex h-11 items-center justify-center gap-2 border border-line px-5 text-[0.65rem] font-medium tracking-[0.18em] text-muted uppercase transition-colors hover:border-crimson hover:text-crimson-bright"
      >
        <X className="size-3.5" aria-hidden />
        Cancelar cupón
      </button>
    </form>
  );
}
