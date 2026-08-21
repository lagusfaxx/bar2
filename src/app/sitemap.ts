import type { MetadataRoute } from "next";

import { getAllEventSlugs, getMenu } from "@/lib/content";
import { absoluteUrl } from "@/lib/utils";

/** Rutas fijas del sitio, con su prioridad relativa. */
const STATIC_ROUTES: Array<{
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}> = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/eventos", priority: 0.95, changeFrequency: "daily" },
  { path: "/carta", priority: 0.85, changeFrequency: "weekly" },
  { path: "/nosotros", priority: 0.7, changeFrequency: "monthly" },
  { path: "/galeria", priority: 0.7, changeFrequency: "weekly" },
  { path: "/ubicacion", priority: 0.75, changeFrequency: "monthly" },
  { path: "/contacto", priority: 0.7, changeFrequency: "monthly" },
  { path: "/barzucard", priority: 0.8, changeFrequency: "weekly" },
  { path: "/barzucard/promociones", priority: 0.75, changeFrequency: "weekly" },
  { path: "/legales", priority: 0.3, changeFrequency: "yearly" },
];

/**
 * Se genera en cada peticion: la lista de eventos sale de la base y el build
 * de la imagen Docker corre sin acceso a PostgreSQL.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [events, menu] = await Promise.all([getAllEventSlugs(), getMenu("web")]);

  const lastMenuUpdate = menu.reduce<Date | undefined>((latest, category) => {
    const candidate = category.updatedAt;
    return !latest || candidate > latest ? candidate : latest;
  }, undefined);

  const staticEntries = STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: route.path === "/carta" ? lastMenuUpdate : new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const eventEntries = events.map((event) => ({
    url: absoluteUrl(`/eventos/${event.slug}`),
    lastModified: event.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticEntries, ...eventEntries];
}
