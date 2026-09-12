"use client";

import { useEffect } from "react";

import { guardarTecladoDeLaUrl } from "@/components/staff/use-pointer";

/**
 * Deja anotado en el equipo el teclado que pidio la direccion.
 *
 * El `?teclado=1` llega a la sala, que es la primera pagina que abre la
 * pantalla del mostrador, y ahi no hay ningun campo de texto: nadie pregunta
 * por el teclado, nadie lo guarda, y al entrar a una mesa —donde si hacen
 * falta— la direccion ya es otra y el parametro se perdio.
 *
 * Va en el layout por lo mismo que `DeadZone`: son dos ajustes de ese monitor
 * y de ningun otro, y valen en todas las pantallas de sala, sin importar cual
 * se abrio primero.
 */
export function KeyboardPref() {
  useEffect(() => {
    guardarTecladoDeLaUrl();
  }, []);

  return null;
}
