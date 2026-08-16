"use client";

import { useEffect } from "react";

/** Donde queda guardada la franja ciega, por equipo. */
const STORAGE_KEY = "barzuo:zona-muerta";

/** Tope de cordura: mas que esto se come la pantalla entera. */
const MAX_PX = 400;

/**
 * La franja de la pantalla tactil que no registra el tacto.
 *
 * La pantalla del local tiene muerta una franja en el borde superior. Usada a
 * pantalla completa —que es como se usa en el mostrador, sin barra de
 * direcciones que estorbe— la cabecera de sala cae dentro de esa franja y el
 * boton de volver deja de existir para el dedo.
 *
 * El alto de esa franja es de ese monitor, no del sitio: los garzones entran
 * desde sus telefonos y ahi no hay nada que compensar. Por eso el valor vive
 * en el equipo (localStorage) y no en los ajustes del panel, que lo aplicaria
 * a todos.
 *
 * Se configura una vez abriendo la sala con `?zonamuerta=80` en ese equipo, y
 * queda guardado. `?zonamuerta=0` lo quita.
 */
export function DeadZone() {
  useEffect(() => {
    const parametro = new URLSearchParams(window.location.search).get(
      "zonamuerta",
    );

    if (parametro !== null) {
      const pedido = Math.min(MAX_PX, Math.max(0, Math.round(Number(parametro))));

      // `Number("")` es 0 y `Number("abc")` es NaN: ambos se leen como
      // "quitala", que es lo que se espera al escribirlo mal a las apuradas.
      if (Number.isFinite(pedido) && pedido > 0) {
        localStorage.setItem(STORAGE_KEY, String(pedido));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    const guardado = Number(localStorage.getItem(STORAGE_KEY) ?? 0);
    const alto = Number.isFinite(guardado) ? Math.min(MAX_PX, Math.max(0, guardado)) : 0;

    document.documentElement.style.setProperty("--staff-dead-zone", `${alto}px`);
  }, []);

  return null;
}
