"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Mantiene la pantalla al dia sin que nadie la recargue.
 *
 * El punto rojo late para que se note que lo que se esta mirando es de ahora:
 * un tablero en vivo que se quedo congelado hace veinte minutos es peor que no
 * tenerlo, porque igual se le cree.
 */
export function LiveRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  const [updated, setUpdated] = useState<string | null>(null);

  useEffect(() => {
    const marcar = () =>
      setUpdated(
        new Date().toLocaleTimeString("es-CL", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      );

    marcar();

    const timer = setInterval(() => {
      router.refresh();
      marcar();
    }, seconds * 1000);

    return () => clearInterval(timer);
  }, [router, seconds]);

  return (
    <p className="flex items-center gap-2 text-xs text-muted">
      <span
        className="size-2 animate-pulse rounded-full bg-crimson-bright"
        aria-hidden
      />
      En vivo
      {updated && <span className="text-muted-dark">· {updated}</span>}
    </p>
  );
}
