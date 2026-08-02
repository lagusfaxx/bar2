import { revalidatePath } from "next/cache";

/**
 * Invalidacion del contenido publico.
 *
 * Las paginas publicas se prerenderizan y se refrescan por tiempo (ver
 * `revalidate` en cada page.tsx). Cuando el CMS guarda un cambio, ademas las
 * marcamos como obsoletas para que la web lo refleje de inmediato.
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
