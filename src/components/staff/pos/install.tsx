"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * El evento con el que Chrome ofrece instalar. No esta en los tipos del DOM
 * porque no es estandar todavia: lo implementan Chrome y los navegadores
 * basados en el, que son los de los telefonos Android del equipo.
 */
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const OCULTO = "barzuo-sala-instalar-oculto";

/**
 * Instalar la sala en el telefono.
 *
 * Hace dos cosas que van juntas: registra el service worker —el que evita el
 * dinosaurio cuando el wifi se cae en la terraza— y ofrece agregar la app a la
 * pantalla de inicio cuando el navegador lo permite.
 *
 * El aviso aparece solo cuando el navegador dice que se puede instalar, y una
 * vez instalada no vuelve a aparecer nunca: quien ya la tiene no necesita que
 * le ofrezcan lo mismo cada noche. Si lo cierra a mano, tampoco.
 */
export function InstallSala() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    // El alcance sube a /staff/pos —sin barra final— gracias a la cabecera
    // `Service-Worker-Allowed` que manda la ruta del worker: es la direccion
    // con la que arranca la app instalada.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/staff/pos/sw.js", { scope: "/staff/pos" })
        .catch(() => {
          // Sin service worker la sala funciona igual: pierde la pantalla de
          // "sin conexion" y poco mas. No hay nada que avisarle al garzon.
        });
    }

    const onPrompt = (event: Event) => {
      // Sin esto, Chrome muestra su propia barra encima de la app.
      event.preventDefault();

      // Quien ya lo cerro a mano no lo vuelve a ver. Se consulta aca —al
      // momento en que el navegador ofrece instalar— y no al montar: asi no
      // hay lectura del telefono en el render y el servidor y el navegador
      // pintan lo mismo.
      if (window.localStorage.getItem(OCULTO) === "1") return;

      setPrompt(event as InstallPrompt);
    };

    const onInstalled = () => setPrompt(null);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!prompt) return null;

  return (
    <div className="mb-5 flex items-center gap-3 border border-gilt/40 bg-gilt/5 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-bone">Instala la sala en este teléfono</p>
        <p className="mt-0.5 text-xs text-muted">
          Queda con su icono en la pantalla de inicio y abre a pantalla completa.
        </p>
      </div>

      <button
        type="button"
        onClick={async () => {
          await prompt.prompt();
          await prompt.userChoice;
          setPrompt(null);
        }}
        className="flex h-11 shrink-0 items-center gap-2 border border-gilt/50 px-4 text-sm text-gilt-soft"
      >
        <Download className="size-4" aria-hidden />
        Instalar
      </button>

      <button
        type="button"
        onClick={() => {
          window.localStorage.setItem(OCULTO, "1");
          setPrompt(null);
        }}
        aria-label="No mostrar más"
        className="flex size-11 shrink-0 items-center justify-center border border-line text-muted"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
