"use client";

import { useSyncExternalStore } from "react";

/**
 * ¿Este aparato necesita que la app le ponga el teclado?
 *
 * La respuesta no es la misma en los dos lugares donde vive el POS, y por eso
 * hasta ahora estaba mal en uno de los dos:
 *
 * - **El telefono del garzon** ya trae teclado. Aparece solo al enfocar un
 *   campo, es el que la persona usa todo el dia, corrige, predice y entiende
 *   su idioma. Poner el nuestro encima es cambiarle una herramienta buena por
 *   una peor, y ademas se comen la mitad de una pantalla que ya es chica.
 * - **La pantalla del mostrador** no trae ninguno: es un PC con mouse, en
 *   modo kiosco, y ahi enfocar un campo no levanta nada. Sin el nuestro, esos
 *   campos son una pared.
 *
 * Lo que separa un caso del otro es que el aparato apunte con un dedo o con un
 * mouse, y eso el navegador ya lo sabe: `(pointer: fine)` es cierto cuando el
 * puntero principal es preciso —un mouse, un trackpad— y falso cuando es un
 * dedo. No hace falta adivinar el aparato por su `user agent`, que es lo que
 * envejece mal y falla justo en el equipo raro del local.
 *
 * En el servidor devuelve `false`: se dibuja la version con teclado del
 * sistema, que es la que no estorba si el aparato resulta ser un telefono. En
 * el mostrador el nuestro aparece al hidratar, unos milisegundos despues.
 */
const PUNTERO_FINO = "(pointer: fine)";

/**
 * Donde queda la decision forzada a mano, por equipo.
 *
 * La regla del puntero acierta en los dos casos que existen hoy, pero hay una
 * combinacion que la engaña: una pantalla tactil sin mouse conectado se
 * declara "dedo" —y entonces no dibujamos el teclado— aunque el sistema
 * tampoco tenga uno que ofrecer. Ahi el equipo se queda sin ninguno.
 *
 * Antes de que eso pase a la mitad de un servicio, se fuerza a mano abriendo
 * la sala con `?teclado=1` en ese equipo (o `?teclado=0` para lo contrario), y
 * queda guardado. `?teclado=auto` devuelve la decision a la regla.
 *
 * Vive en el equipo y no en los ajustes del panel, que lo aplicaria a todos:
 * es una particularidad de ese monitor, igual que la franja ciega.
 */
const STORAGE_KEY = "barzuo:teclado-propio";

/** Lo forzado en la direccion, que ademas es como se configura. */
function forzadoEnLaUrl(): boolean | null {
  const valor = new URLSearchParams(window.location.search).get("teclado");

  if (valor === "1") return true;
  if (valor === "0") return false;
  return null;
}

/** Lo forzado alguna vez en este equipo. */
function forzadoEnElEquipo(): boolean | null {
  try {
    const valor = localStorage.getItem(STORAGE_KEY);

    if (valor === "1") return true;
    if (valor === "0") return false;
  } catch {
    // Navegacion privada o cookies bloqueadas: se sigue con la regla.
  }

  return null;
}

function subscribe(alCambiar: () => void) {
  /*
   * Se guarda lo que venga en la direccion, para que valga tambien la proxima
   * vez que se abra la sala sin el parametro. Va aca y no al leer el valor
   * porque leer tiene que poder repetirse sin efectos.
   */
  const forzado = forzadoEnLaUrl();

  try {
    if (forzado !== null) localStorage.setItem(STORAGE_KEY, forzado ? "1" : "0");
    else if (new URLSearchParams(window.location.search).get("teclado") === "auto") {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Sin donde guardar, el parametro vale solo para esta visita.
  }

  const mq = window.matchMedia(PUNTERO_FINO);

  // Un mouse se puede conectar y desconectar en caliente: la pantalla del
  // local puede arrancar sin el y recibirlo despues.
  mq.addEventListener("change", alCambiar);
  return () => mq.removeEventListener("change", alCambiar);
}

const getSnapshot = () =>
  forzadoEnLaUrl() ??
  forzadoEnElEquipo() ??
  window.matchMedia(PUNTERO_FINO).matches;

const getServerSnapshot = () => false;

export function useTecladoPropio() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
