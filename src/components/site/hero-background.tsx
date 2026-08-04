"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * Fondo de la portada: imagen siempre, video solo cuando corresponde.
 *
 * El video de fondo es un lujo de escritorio. En un telefono con datos moviles
 * son varios megas —hasta 32— descargados para algo que ademas va tapado por
 * un degradado, y encima es el elemento mas grande de la pagina: mientras baja,
 * la portada se ve vacia. Por eso el telefono se queda con la imagen, que ya
 * esta optimizada y pesa una fraccion.
 *
 * La imagen se pinta siempre y de inmediato; el video, si entra, se monta
 * despues y encima. Asi nunca hay un momento sin fondo.
 */
export function HeroBackground({
  background,
  backgroundPortrait,
  videoUrl,
  videoPosterUrl,
}: {
  background: string;
  backgroundPortrait: string | null;
  videoUrl: string | null;
  videoPosterUrl: string | null;
}) {
  const [playVideo, setPlayVideo] = useState(false);

  useEffect(() => {
    if (!videoUrl) return;

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

    const decide = () => setPlayVideo(wide.matches && goodConnection);

    decide();
    wide.addEventListener("change", decide);
    return () => wide.removeEventListener("change", decide);
  }, [videoUrl]);

  return (
    <>
      {/* Direccion de arte: en vertical, recortar una foto apaisada deja fuera
          la parte iluminada. Cuando existe una variante vertical se usa esa en
          pantallas chicas. */}
      {backgroundPortrait && (
        <Image
          src={backgroundPortrait}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover sm:hidden"
        />
      )}

      <Image
        src={videoPosterUrl ?? background}
        alt=""
        fill
        priority
        sizes="100vw"
        className={
          backgroundPortrait
            ? "hidden object-cover object-[50%_35%] sm:block"
            : "object-cover object-[50%_35%]"
        }
      />

      {playVideo && videoUrl && (
        <video
          className="absolute inset-0 size-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          // Sin poster: debajo ya esta la imagen, que se pinto primero.
          aria-hidden
        >
          <source src={videoUrl} />
        </video>
      )}
    </>
  );
}
