import { getImageProps } from "next/image";

import { HeroVideo } from "@/components/site/hero-video";

/**
 * Fondo de la portada: una sola imagen, la que corresponda, y el video solo
 * donde tiene sentido cargarlo.
 *
 * Aca estaba el peor costo del sitio en telefono. Habia dos `<Image>` —la
 * vertical con `sm:hidden` y la apaisada con `hidden sm:block`— y las dos con
 * prioridad. `hidden` es una regla de CSS: no impide descargar nada, y la
 * prioridad ademas inserta un `<link rel="preload">` en la cabecera por cada
 * una. O sea que el telefono empezaba a bajar las dos fotos mas pesadas de la
 * pagina antes de leer el `<body>`, se peleaban el ancho de banda entre ellas,
 * y una de las dos —la mitad de esos datos— terminaba descartada sin verse
 * nunca. Con la portada como elemento mas grande de la pantalla, eso es
 * exactamente el "tarda mucho y despues aparece de golpe".
 *
 * `<picture>` con `media` lo resuelve donde corresponde: la eleccion la hace
 * el navegador antes de pedir el archivo, asi que baja una sola. Los srcset
 * los sigue armando Next con `getImageProps`, de modo que no se pierde ni el
 * redimensionado ni el WebP ni el cache de /_next/image.
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
  const common = { alt: "", sizes: "100vw" };

  const {
    props: { srcSet: landscape, ...rest },
  } = getImageProps({
    ...common,
    src: videoPosterUrl ?? background,
    width: 1920,
    height: 1080,
  });

  // Direccion de arte: en vertical, recortar una foto apaisada deja fuera la
  // parte iluminada. Cuando existe una variante vertical se usa esa en
  // pantallas chicas.
  const portrait = backgroundPortrait
    ? getImageProps({
        ...common,
        src: backgroundPortrait,
        width: 1080,
        height: 1920,
      }).props.srcSet
    : null;

  return (
    <>
      <picture>
        {portrait && <source media="(max-width: 639px)" srcSet={portrait} />}
        <img
          {...rest}
          srcSet={landscape}
          alt=""
          // Sin `<link rel="preload">`. Una precarga no puede elegir entre las
          // dos variantes —es justamente lo que fallaba antes: dos precargas
          // ciegas, una siempre descartada—, y probada a mano, adelantar el
          // aviso 1,6 KB dentro del mismo documento no movio la aguja: el
          // analizador de recursos del navegador ya lee ese trecho de una.
          // `fetchPriority="high"` sobre la etiqueta, que es lo que la
          // documentacion de Next recomienda para direccion de arte, si sirve:
          // marca la urgencia de la unica imagen que se va a mostrar.
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className={
            portrait
              ? "absolute inset-0 size-full object-cover object-center sm:object-[50%_35%]"
              : "absolute inset-0 size-full object-cover object-[50%_35%]"
          }
        />
      </picture>

      {videoUrl && <HeroVideo url={videoUrl} />}
    </>
  );
}
