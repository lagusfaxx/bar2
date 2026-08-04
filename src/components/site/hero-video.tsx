"use client";

import { useEffect, useState } from "react";

/**
 * Video de fondo de la portada, montado solo donde corresponde.
 *
 * El video de fondo es un lujo de escritorio. En un telefono con datos moviles
 * son varios megas —hasta 32— descargados para algo que ademas va tapado por
 * un degradado, y encima seria el elemento mas grande de la pagina: mientras
 * baja, la portada se ve vacia. Por eso el telefono se queda con la imagen,
 * que ya esta optimizada y pesa una fraccion.
 *
 * Es la unica parte del fondo que necesita ejecutarse en el navegador —la
 * decision depende del ancho real y de la conexion—, asi que vive en su propio
 * archivo. El resto de la portada es HTML de servidor y se pinta sin esperar a
 * nada: la imagen esta debajo desde el primer cuadro y el video, si entra,
 * aparece encima. Nunca hay un momento sin fondo.
 */
export function HeroVideo({ url }: { url: string }) {
  const [play, setPlay] = useState(false);

  useEffect(() => {
    // Pantalla de escritorio. Se decide por el ancho y no por el "user agent",
    // que miente y envejece mal.
    const wide = window.matchMedia("(min-width: 1024px)");

    /** Conexion medida por el navegador, cuando la expone (Chrome, Android). */
    const connection = (
      navigator as Navigator & {
        connection?: { effectiveType?: string; saveData?: boolean };
      }
    ).connection;

    const goodConnection =
      !connection ||
      (!connection.saveData &&
        !["slow-2g", "2g", "3g"].includes(connection.effectiveType ?? ""));

    const decide = () => setPlay(wide.matches && goodConnection);

    decide();
    wide.addEventListener("change", decide);
    return () => wide.removeEventListener("change", decide);
  }, []);

  if (!play) return null;

  return (
    <video
      className="absolute inset-0 size-full object-cover"
      autoPlay
      muted
      loop
      playsInline
      // Sin poster: debajo ya esta la imagen, que se pinto primero.
      aria-hidden
    >
      <source src={url} />
    </video>
  );
}
