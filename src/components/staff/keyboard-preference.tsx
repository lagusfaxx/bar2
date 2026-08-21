"use client";

import { useEffect } from "react";

import { aplicarPreferenciaDeTeclado } from "@/components/staff/use-pointer";

/**
 * Aplica la preferencia de teclado de este equipo.
 *
 * Va en el armazon de sala, al lado de `DeadZone` y por la misma razon: son
 * dos rarezas del monitor del mostrador —cual es su franja ciega, si levanta o
 * no un teclado— que valen para ese equipo y para ninguno mas, asi que se
 * configuran una vez ahi y quedan guardadas ahi.
 *
 * Tiene que estar en el armazon y no dentro de la pantalla que usa el teclado:
 * `?teclado=1` se escribe entrando por donde uno entra —la sala, casi
 * siempre—, no por la pantalla concreta donde despues hara falta escribir.
 */
export function PreferenciaDeTeclado() {
  useEffect(() => {
    aplicarPreferenciaDeTeclado();
  }, []);

  return null;
}
