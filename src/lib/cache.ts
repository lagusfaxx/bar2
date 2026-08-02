import { revalidatePath } from "next/cache";

/**
 * Invalidacion del contenido publico.
 *
 * Las paginas publicas se renderizan en cada peticion (ver `dynamic` en el
 * layout raiz), asi que el contenido ya sale siempre fresco de la base. Estas
 * llamadas descartan ademas el cache de navegacion del cliente, para que quien
 * acaba de guardar en el panel no vea la version anterior al volver a la web.
 *
 * Nota: no usamos `unstable_cache` en la capa de datos porque serializa los
 * valores y convierte los `Date` de Prisma en strings al leer del cache.
 */
export const PUBLIC_PATHS = [
  "/",
  "/eventos",
  "/carta",
  "/nosotros",
  "/galeria",
  "/ubicacion",
  "/contacto",
  "/legales",
  "/barzucard",
  "/barzucard/promociones",
] as const;

export type ContentArea =
  | "settings"
  | "events"
  | "menu"
  | "gallery"
  | "promotions"
  | "social"
  | "hours";

/**
 * Refresca la web publica tras un cambio en el panel.
 *
 * El sitio es chico y los datos se comparten entre secciones (el home muestra
 * cartelera, carta y galeria a la vez), asi que invalidamos todo el frente
 * publico: es mas barato que razonar caso por caso y no deja nada obsoleto.
 */
export function revalidateContent(...areas: ContentArea[]) {
  for (const path of PUBLIC_PATHS) {
    revalidatePath(path);
  }

  // Las fichas de evento son rutas dinamicas: se invalidan como plantilla.
  if (areas.length === 0 || areas.includes("events")) {
    revalidatePath("/eventos/[slug]", "page");
  }

  revalidatePath("/sitemap.xml");
}
