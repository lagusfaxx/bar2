"use client";

import { useSyncExternalStore } from "react";

/** Un tick por segundo mientras el cupon este en pantalla. */
function subscribeToSeconds(onChange: () => void) {
  const id = setInterval(onChange, 1000);
  return () => clearInterval(id);
}

function format(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Cuenta atras de la vigencia del cupon.
 *
 * El valor sale del reloj del navegador, asi que el servidor no puede
 * calcularlo: `useSyncExternalStore` deja explicito que en el HTML inicial no
 * hay dato y evita cualquier desajuste de hidratacion.
 */
export function VoucherCountdown({
  expiresAt,
  className,
}: {
  expiresAt: string;
  className?: string;
}) {
  const target = new Date(expiresAt).getTime();

  const remaining = useSyncExternalStore(
    subscribeToSeconds,
    () => Math.max(0, Math.ceil((target - Date.now()) / 1000)),
    () => null,
  );

  if (remaining === null) {
    return (
      <span className={className} suppressHydrationWarning>
        Vigencia limitada
      </span>
    );
  }

  if (remaining === 0) {
    return <span className={className}>Cupón vencido — pedí uno nuevo</span>;
  }

  return (
    <span className={className}>
      Válido por{" "}
      <span className="tabular-nums text-bone">{format(remaining)}</span>
    </span>
  );
}
