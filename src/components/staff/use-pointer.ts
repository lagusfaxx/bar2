"use client";

import { useSyncExternalStore } from "react";

/**
 * ¿Este aparato necesita que la app le ponga el teclado?
 *
 * La respuesta no es la misma en los dos lugares donde vive el POS:
 *
 * - **El telefono del garzon** ya trae teclado. Aparece solo al enfocar un
 *   campo, es el que la persona usa todo el dia, corrige, predice y entiende
 *   su idioma. Poner el nuestro encima es cambiarle una herramienta buena por
 *   una peor, y ademas se come la mitad de una pantalla que ya es chica.
 * - **La pantalla del mostrador** puede no traer ninguno: en modo kiosco,
 *   enfocar un campo no levanta nada. Sin el nuestro, esos campos son una
 *   pared.
 *
 * La regla mira con que apunta el aparato, que el navegador ya sabe:
 * `(pointer: fine)` es cierto cuando el puntero principal es preciso —un
 * mouse, un trackpad— y falso cuando es un dedo. No hace falta adivinar el
 * aparato por su `user agent`, que envejece mal.
 *
 * Pero la regla tiene un punto ciego conocido, y es justo el del local: **una
 * pantalla tactil sin mouse se declara "dedo"** aunque el sistema tampoco
 * tenga un teclado que ofrecer. Ese equipo se queda sin ninguno. Para eso esta
 * la preferencia forzada de abajo, que manda sobre la regla.
 *
 * En el servidor devuelve `false`: se dibuja la version con teclado del
 * sistema, que es la que no estorba si el aparato resulta ser un telefono.
 */
const PUNTERO_FINO = "(pointer: fine)";

/** Donde queda la decision forzada a mano, por equipo. */
const STORAGE_KEY = "barzuo:teclado-propio";

/**
 * La preferencia de este equipo, ya leida.
 *
 * `null` es "no hay ninguna, decide la regla". Vive en el modulo y no en un
 * estado de React porque la comparten el componente que la aplica y todas las
 * pantallas que la consultan.
 */
let forzado: boolean | null = null;

const oyentes = new Set<() => void>();

function avisar() {
  for (const oyente of oyentes) oyente();
}

function leerGuardada(): boolean | null {
  try {
    const valor = localStorage.getItem(STORAGE_KEY);

    if (valor === "1") return true;
    if (valor === "0") return false;
  } catch {
    // Navegacion privada o cookies bloqueadas: se sigue con la regla.
  }

  return null;
}

/**
 * Lee `?teclado=` de la direccion y lo deja fijado en este equipo.
 *
 * La llama `<PreferenciaDeTeclado />` desde el armazon de sala, asi que
 * funciona entrando por cualquier pantalla del equipo —la sala, una cuenta, la
 * barra— y no solo por aquellas que resulten tener un campo de texto. Esa era
 * justamente la trampa de la primera version: se leia dentro del propio hook,
 * que solo esta montado donde hay algo que escribir, asi que abrir la sala con
 * el parametro no hacia nada y parecia que la salida no existia.
 *
 * `?teclado=1` fuerza el nuestro, `?teclado=0` el del sistema, `?teclado=auto`
 * devuelve la decision a la regla. Queda guardado en el equipo, no en los
 * ajustes del panel, porque es una particularidad de ese monitor —igual que la
 * franja ciega—.
 */
export function aplicarPreferenciaDeTeclado() {
  const pedido = new URLSearchParams(window.location.search).get("teclado");

  if (pedido === "1" || pedido === "0") {
    try {
      localStorage.setItem(STORAGE_KEY, pedido);
    } catch {
      // Sin donde guardar, vale solo para esta visita.
    }
    forzado = pedido === "1";
    avisar();
    return;
  }

  if (pedido === "auto") {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nada que limpiar.
    }
    forzado = null;
    avisar();
    return;
  }

  const guardada = leerGuardada();

  if (guardada !== forzado) {
    forzado = guardada;
    avisar();
  }
}

function subscribe(alCambiar: () => void) {
  oyentes.add(alCambiar);

  // Un mouse se puede conectar y desconectar en caliente: la pantalla del
  // local puede arrancar sin el y recibirlo despues.
  const mq = window.matchMedia(PUNTERO_FINO);
  mq.addEventListener("change", alCambiar);

  return () => {
    oyentes.delete(alCambiar);
    mq.removeEventListener("change", alCambiar);
  };
}

const getSnapshot = () =>
  forzado ?? window.matchMedia(PUNTERO_FINO).matches;

const getServerSnapshot = () => false;

export function useTecladoPropio() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
