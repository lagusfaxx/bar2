import { getSettings } from "@/lib/content";

/**
 * Manifiesto de la app de sala.
 *
 * Es lo que hace que /staff/pos se pueda instalar en el telefono del garzon y
 * quede como una app mas, con su icono en la pantalla de inicio y sin la barra
 * de direcciones comiendose un renglon.
 *
 * Instala solo la sala, no el sitio. Por eso el manifiesto vive en esta ruta y
 * no en la raiz: el `scope` es /staff/pos, asi que la web publica —la carta,
 * los eventos, BarzuCard— se sigue abriendo en el navegador como siempre. Un
 * manifiesto en la raiz habria ofrecido "instalar BARZUO" a cada persona que
 * entra a ver la cartelera.
 *
 * El nombre sale de Ajustes: la app se llama como el bar.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();

  const manifest = {
    id: "/staff/pos",
    name: `${settings.barName} · Sala`,
    // El nombre corto es el que va debajo del icono, y ahi entran unos pocos
    // caracteres: "Sala" es como se llama a esta pantalla en el local.
    short_name: "Sala",
    description:
      "Mesas, comandas y cobros de sala. Para el equipo de " + settings.barName + ".",
    start_url: "/staff/pos",
    scope: "/staff/pos",
    display: "standalone",
    orientation: "portrait",
    background_color: "#08070a",
    theme_color: "#08070a",
    lang: "es-CL",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/staff/pos/icono.png?size=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/staff/pos/icono.png?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // El icono "maskable" es el que Android recorta a la forma del sistema
      // —circulo, cuadrado redondeado—. Va con margen propio para que el
      // recorte no se coma la marca.
      {
        src: "/staff/pos/icono.png?size=512&maskable=1",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };

  return Response.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
