"use client";

import { useSyncExternalStore } from "react";

/**
 * ¿Pone la app su propio teclado, o lo pone el aparato?
 *
 * El teclado de `keyboard.tsx` existe por la pantalla del mostrador: un
 * navegador de kiosco sobre Windows o Linux no levanta ninguno al enfocar un
 * campo, asi que sin el la app entera es de solo lectura. Pero en un telefono
 * esa misma decision es un estorbo: el aparato ya trae teclado, el garzon lo
 * conoce, corrige, predice y tiene su ñ y sus acentos, y el nuestro solo le
 * tapa la mitad del panel con teclas que escriben peor.
 *
 * La linea que separa un caso del otro es el puntero. `pointer: fine` es el
 * mouse del mostrador; un dedo es `coarse` y ahi el sistema siempre levanta el
 * suyo. Se consulta en vivo —no una sola vez al montar— porque a la misma
 * pantalla se le puede enchufar o quitar el mouse con la app abierta.
 *
 * En el servidor no hay puntero que consultar: se asume el telefono, que es el
 * caso que no puede quedarse sin teclado si la hidratacion tarda.
 */
const CON_MOUSE = "(pointer: fine)";

function subscribe(alCambiar: () => void) {
  const consulta = window.matchMedia(CON_MOUSE);
  consulta.addEventListener("change", alCambiar);
  return () => consulta.removeEventListener("change", alCambiar);
}

export function useTecladoPropio() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(CON_MOUSE).matches,
    () => false,
  );
}
