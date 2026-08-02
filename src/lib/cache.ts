import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Etiquetas de cache. Cada consulta publica se registra con una de estas y el
 * CMS las invalida al guardar, para que los cambios se vean al instante.
 */
export const TAGS = {
  settings: "settings",
  events: "events",
  menu: "menu",
  gallery: "gallery",
  promotions: "promotions",
  social: "social",
  hours: "hours",
} as const;

export type CacheTag = (typeof TAGS)[keyof typeof TAGS];

/** Invalida una o varias etiquetas y refresca las rutas publicas afectadas. */
export function revalidateContent(...tags: CacheTag[]) {
  for (const tag of tags) {
    revalidateTag(tag);
  }

  // El home compone datos de casi todas las secciones.
  revalidatePath("/");

  if (tags.includes(TAGS.events)) {
    revalidatePath("/eventos");
    revalidatePath("/eventos/[slug]", "page");
    revalidatePath("/sitemap.xml");
  }

  if (tags.includes(TAGS.menu)) {
    revalidatePath("/carta");
  }

  if (tags.includes(TAGS.gallery)) {
    revalidatePath("/galeria");
  }

  if (tags.includes(TAGS.promotions)) {
    revalidatePath("/barzucard");
    revalidatePath("/barzucard/promociones");
  }

  if (tags.includes(TAGS.settings) || tags.includes(TAGS.social) || tags.includes(TAGS.hours)) {
    revalidatePath("/nosotros");
    revalidatePath("/ubicacion");
    revalidatePath("/contacto");
  }
}
