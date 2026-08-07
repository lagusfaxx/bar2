"use client";

import { useEffect } from "react";

/**
 * Mantiene la pantalla encendida mientras la vista este abierta.
 *
 * Las pantallas de cocina, barra y karaoke viven colgadas de una pared y no se
 * tocan: la de cocina justamente porque ahi nadie tiene las manos limpias. Sin
 * esto, el aparato se apaga solo a los dos minutos y hay que ir a despertarlo
 * —tocandolo— cada vez que alguien quiere mirar.
 *
 * `wakeLock` no existe en todos los navegadores y el sistema lo suelta al
 * cambiar de pestaña o bloquear el equipo, asi que se vuelve a pedir cada vez
 * que la vista se hace visible. Si el navegador no lo soporta, no pasa nada:
 * queda la pantalla como estaba y el ajuste hay que hacerlo en el aparato.
 */
export function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;

    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      if (document.visibilityState !== "visible") return;

      try {
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await lock.release();
          lock = null;
        }
      } catch {
        // Lo tipico es que el sistema lo niegue por bateria baja. No hay nada
        // que hacer ni nada util que decirle a quien mira el tablero.
      }
    };

    request();
    document.addEventListener("visibilitychange", request);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", request);
      lock?.release().catch(() => {});
    };
  }, []);
}
