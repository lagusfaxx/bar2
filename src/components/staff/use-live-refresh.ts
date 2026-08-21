"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Mantiene la vista al dia sin que nadie la toque.
 *
 * La sala se mira desde dos aparatos a la vez: el garzon carga desde su
 * telefono, camina hasta la caja y espera encontrar ahi lo que acaba de
 * cargar. Sin esto no lo encuentra —la pantalla del local quedo con el estado
 * de cuando alguien la toco por ultima vez— y termina creyendo que el sistema
 * perdio el pedido.
 *
 * Antes cada vuelta rearmaba la pantalla entera contra la base, cambiara algo o
 * no. Una mesa abierta con su carta son mas de diez consultas y un envio
 * grande al telefono, y eso se pagaba cada diez o quince segundos por cada
 * aparato encendido, toda la noche. Ahora primero pregunta: el servidor
 * responde con una marca del estado —una consulta y unos pocos bytes— y la
 * pantalla se rearma solo cuando esa marca cambio. En un bar la mayoria de las
 * vueltas no cambia nada, asi que la mayoria ya no cuesta nada.
 *
 * Se detiene cuando la vista no esta visible: un telefono en el bolsillo no
 * tiene por que pedir la sala cada diez segundos toda la noche.
 */

export type LiveScope =
  | { kind: "sala" }
  | { kind: "cuenta"; sessionId: string }
  | { kind: "estacion"; station: "BARRA" | "COCINA" };

function versionUrl(scope: LiveScope) {
  const params = new URLSearchParams({ scope: scope.kind });

  if (scope.kind === "cuenta") params.set("sesion", scope.sessionId);
  if (scope.kind === "estacion") params.set("estacion", scope.station);

  return `/api/pos/version?${params}`;
}

/** Tras estos fallos seguidos se vuelve a rearmar a ciegas, como antes. */
const FALLOS_TOLERADOS = 3;

export function useLiveRefresh(
  intervalMs: number,
  scope: LiveScope,
  /** La marca con la que se dibujo esta pantalla, calculada en el servidor. */
  version: string,
) {
  const router = useRouter();

  // La ultima marca conocida. En una ref y no en estado: cambiarla no tiene
  // que redibujar nada, solo sirve para comparar en la siguiente vuelta.
  const conocida = useRef(version);
  const fallos = useRef(0);

  /*
   * Una pregunta a la vez.
   *
   * El sondeo dispara cada pocos segundos, y al volver a mirar el aparato
   * dispara ademas una vuelta suelta. Si el servidor esta lento, esas vueltas
   * se encimaban: cada una abria su peticion y todas llegaban juntas, justo
   * cuando el servidor ya no daba abasto. Mientras haya una en curso, la
   * siguiente se saltea — la de despues pregunta lo mismo.
   */
  const enVuelo = useRef(false);

  // Al rearmarse la pantalla llega la marca nueva desde el servidor.
  useEffect(() => {
    conocida.current = version;
  }, [version]);

  useEffect(() => {
    const url = versionUrl(scope);

    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      if (enVuelo.current) return;

      enVuelo.current = true;

      try {
        const response = await fetch(url, { cache: "no-store" });

        // Sesion vencida o servidor con problemas: no se insiste con un
        // rearmado que tampoco iba a funcionar.
        if (!response.ok) throw new Error(String(response.status));

        const { v } = (await response.json()) as { v?: string };

        fallos.current = 0;

        if (typeof v !== "string" || v === conocida.current) return;

        conocida.current = v;
        router.refresh();
      } catch {
        /*
         * Si el sondeo se rompe, la pantalla no puede quedarse congelada toda
         * la noche: despues de unos cuantos fallos seguidos se vuelve al
         * comportamiento de antes —rearmar y ver— hasta que se recupere.
         */
        fallos.current += 1;

        if (fallos.current >= FALLOS_TOLERADOS) {
          fallos.current = 0;
          router.refresh();
        }
      } finally {
        enVuelo.current = false;
      }
    };

    const timer = setInterval(tick, intervalMs);

    // Al volver a mirar el aparato, lo primero es ponerse al dia: esperar al
    // siguiente intervalo mostraria un estado viejo justo cuando alguien
    // acaba de acercarse a leerlo.
    const alVolver = () => void tick();
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", alVolver);
    };
    // El ambito es un objeto literal: se compara por su contenido, que es lo
    // que de verdad decide a que se sondea.
  }, [router, intervalMs, JSON.stringify(scope)]); // eslint-disable-line react-hooks/exhaustive-deps
}
