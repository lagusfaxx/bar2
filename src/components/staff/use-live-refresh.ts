"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Mantiene la vista al dia sin que nadie la toque.
 *
 * La sala se mira desde dos aparatos a la vez: el garzon carga desde su
 * telefono, camina hasta la caja y espera encontrar ahi lo que acaba de
 * cargar. Sin esto no lo encuentra —la pantalla del local quedo con el estado
 * de cuando alguien la toco por ultima vez— y termina creyendo que el sistema
 * perdio el pedido.
 *
 * Es la misma idea que ya usaban las pantallas de cocina y barra, sacada a un
 * lugar comun.
 *
 * Se detiene cuando la vista no esta visible: un telefono en el bolsillo no
 * tiene por que pedir la sala cada diez segundos toda la noche.
 */
export function useLiveRefresh(intervalMs: number) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
    };

    const timer = setInterval(tick, intervalMs);

    // Al volver a mirar el aparato, lo primero es ponerse al dia: esperar al
    // siguiente intervalo mostraria un estado viejo justo cuando alguien
    // acaba de acercarse a leerlo.
    document.addEventListener("visibilitychange", tick);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, intervalMs]);
}
