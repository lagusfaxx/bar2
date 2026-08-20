import { revalidatePath } from "next/cache";

import { purgeEdgeCache } from "@/lib/cloudflare";
import { invalidatePosMenu } from "@/lib/pos";

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

  // La app de sala guarda la carta en memoria un minuto para no consultarla en
  // cada toque (ver lib/pos.ts). Al guardar un cambio se descarta esa copia:
  // quien cambia un precio en el panel espera verlo en el POS enseguida, no
  // dentro de un minuto.
  if (areas.length === 0 || areas.includes("menu")) {
    invalidatePosMenu();
  }

  // Las fichas de evento son rutas dinamicas: se invalidan como plantilla.
  if (areas.length === 0 || areas.includes("events")) {
    revalidatePath("/eventos/[slug]", "page");
  }

  revalidatePath("/sitemap.xml");

  // Cloudflare guarda el HTML publico durante horas. Sin este aviso, un cambio
  // del panel tardaria todo ese tiempo en verse. No se espera la respuesta: el
  // guardado no depende de que Cloudflare conteste.
  void purgeEdgeCache();
}
