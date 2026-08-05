import { ImageResponse } from "next/og";

import { getSettings } from "@/lib/content";
import { absoluteUrl } from "@/lib/utils";

/**
 * Icono del sitio.
 *
 * Antes convivia con un `app/favicon.ico` y el favicon cargado desde Ajustes no
 * se veia nunca: Next pone siempre el `favicon.ico` del proyecto como primer
 * `<link rel="icon">` —con `sizes="any"`, que es el que el navegador prefiere—,
 * por delante del que declara `metadata.icons`. Se elimino ese archivo, asi que
 * el unico icono de fabrica es este.
 *
 * Cuando el administrador carga un favicon propio, el layout lo declara en
 * `metadata.icons` y esa URL (con hash en el nombre) reemplaza a esta ruta en
 * el `<head>`. Esta ruta igual lo respeta, porque hay clientes que piden
 * /favicon.ico a ciegas y el proxy los trae aca.
 */
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Lee la base en cada peticion: el favicon se cambia desde el panel y esta
// ruta no puede quedar congelada en el build.
export const dynamic = "force-dynamic";

export default async function Icon() {
  const settings = await getSettings();

  if (settings.faviconUrl) {
    // El archivo lo sirve /uploads (o un host externo). Redirigir evita
    // duplicar aca la lectura del volumen y sus tipos de contenido.
    return Response.redirect(
      settings.faviconUrl.startsWith("/")
        ? absoluteUrl(settings.faviconUrl)
        : settings.faviconUrl,
      307,
    );
  }

  // Icono de fabrica: la "Z" del logotipo en blanco hueso sobre negro.
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#08070a",
          color: "#f4efe7",
          fontSize: 46,
          fontWeight: 700,
          fontFamily: "Georgia, serif",
          borderBottom: "5px solid #b4111b",
        }}
      >
        Z
      </div>
    ),
    size,
  );
}
