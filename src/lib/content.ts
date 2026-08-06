import "server-only";

import { cache } from "react";

import { dateOnlyKey, dayKey } from "@/lib/format";

import type { EventCategory } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/**
 * Consultas de contenido publico.
 *
 * Son consultas planas a Prisma, sin cache entre peticiones: las paginas se
 * renderizan en cada visita contra la base local y siempre muestran lo ultimo
 * que guardo el CMS. No se usa `unstable_cache` a proposito, porque serializa
 * los valores y convierte los `Date` de Prisma en strings al leerlos.
 *
 * Lo que si se hace es deduplicar DENTRO de una misma peticion, con `cache`
 * de React: los ajustes del sitio los piden el layout raiz, su
 * `generateMetadata`, el layout publico y la propia pagina — cuatro veces la
 * misma fila, que es de las mas anchas del esquema. Con `cache` se consulta
 * una y las otras tres reciben la misma promesa. No cambia lo que se ve: al
 * terminar la peticion se descarta.
 */

// --- Ajustes del sitio -------------------------------------------------------

export type SiteSettings = Awaited<ReturnType<typeof getSettings>>;

export const getSettings = cache(async () => {
  const existing = await prisma.siteSettings.findUnique({
    where: { id: "singleton" },
  });

  if (existing) return existing;

  // Primer arranque sin seed: creamos la fila con los valores por defecto del
  // schema para que la web nunca quede sin contenido.
  return prisma.siteSettings.create({ data: { id: "singleton" } });
});

export const getSocialLinks = cache(() =>
  prisma.socialLink.findMany({
    where: { active: true },
    orderBy: { position: "asc" },
  }),
);

export const getOpeningHours = cache(() =>
  prisma.openingHour.findMany({ orderBy: { dayOfWeek: "asc" } }),
);

/**
 * Dias en que el local no abre, de hoy en adelante.
 *
 * Se piden solo los futuros: la cartelera mira hacia adelante y arrastrar el
 * historial completo no aporta nada. El limite es generoso —un año— porque son
 * pocas filas y asi el calendario puede adelantar meses sin volver a consultar.
 */
export const getClosedDays = cache(async () => {
  const desde = new Date();
  desde.setHours(0, 0, 0, 0);

  const hasta = new Date(desde);
  hasta.setFullYear(hasta.getFullYear() + 1);

  return prisma.closedDay.findMany({
    where: { date: { gte: desde, lte: hasta } },
    orderBy: { date: "asc" },
    select: { id: true, date: true, reason: true },
  });
});

// --- Eventos -----------------------------------------------------------------

const eventCardSelect = {
  id: true,
  slug: true,
  title: true,
  artist: true,
  category: true,
  excerpt: true,
  posterUrl: true,
  coverUrl: true,
  startsAt: true,
  doorsAt: true,
  isFree: true,
  priceCents: true,
  ticketUrl: true,
  featured: true,
} as const;

export type EventCard = Awaited<ReturnType<typeof getUpcomingEvents>>[number];

/**
 * Los dias cerrados, indexados por dia.
 *
 * Son un puñado de filas —los cierres de un año caben en los dedos de dos
 * manos—, asi que se traen todas y se cruzan en memoria. Una consulta por
 * evento seria muchisimo mas cara para responder la misma pregunta.
 */
const getClosedDayMap = cache(async () => {
  const rows = await prisma.closedDay.findMany({
    select: { date: true, reason: true },
  });

  return new Map(rows.map((row) => [dateOnlyKey(row.date), row.reason]));
});

/** El motivo del cierre de un dia, o null si el local abre. */
export async function getPrivateReason(date: Date) {
  const cerrados = await getClosedDayMap();
  return cerrados.get(dayKey(date)) ?? null;
}

/**
 * Marca los eventos que caen en un dia cerrado al publico.
 *
 * Un show en un dia arrendado no se esconde: se muestra diciendo que es
 * privado. El local gana con eso —el flyer sigue a la vista y quien lo mira se
 * entera de que el sitio se puede arrendar—, y quien pensaba ir se ahorra el
 * viaje. Esconderlo dejaba a esa persona sin ninguna de las dos cosas.
 *
 * Se resuelve aca, en la capa de datos, para que la marca llegue igual a la
 * portada, a la cartelera, al calendario y a la ficha del evento sin que cada
 * pantalla tenga que acordarse de preguntar.
 */
async function markPrivate<T extends { startsAt: Date }>(events: T[]) {
  const cerrados = await getClosedDayMap();

  return events.map((event) => ({
    ...event,
    /** Motivo del cierre ("Evento privado"), o null si el local abre. */
    privateReason: cerrados.get(dayKey(event.startsAt)) ?? null,
  }));
}

/**
 * Un evento sigue considerandose "proximo" durante la madrugada siguiente: un
 * show del sabado a las 23:00 no debe desaparecer de la cartelera a medianoche.
 */
function upcomingFrom() {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 6);
  return cutoff;
}

export async function getUpcomingEvents(take = 24) {
  return markPrivate(
    await prisma.event.findMany({
      where: { published: true, startsAt: { gte: upcomingFrom() } },
      orderBy: { startsAt: "asc" },
      take,
      select: eventCardSelect,
    }),
  );
}

export async function getFeaturedEvents(take = 3) {
  return markPrivate(
    await prisma.event.findMany({
      where: {
        published: true,
        featured: true,
        startsAt: { gte: upcomingFrom() },
      },
      orderBy: { startsAt: "asc" },
      take,
      select: eventCardSelect,
    }),
  );
}

export async function getPastEvents(take = 12) {
  return markPrivate(
    await prisma.event.findMany({
      where: { published: true, startsAt: { lt: upcomingFrom() } },
      orderBy: { startsAt: "desc" },
      take,
      select: eventCardSelect,
    }),
  );
}

/** Rango amplio de eventos publicados: alimenta el calendario del cliente. */
export async function getEventsInRange(fromIso: string, toIso: string) {
  return markPrivate(
    await prisma.event.findMany({
      where: {
        published: true,
        startsAt: { gte: new Date(fromIso), lt: new Date(toIso) },
      },
      orderBy: { startsAt: "asc" },
      select: eventCardSelect,
    }),
  );
}

export function getEventBySlug(slug: string) {
  return prisma.event.findFirst({
    where: { slug, published: true },
    include: {
      gallery: {
        where: { active: true },
        orderBy: { position: "asc" },
      },
      ratings: {
        where: { approved: true },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          authorName: true,
          rating: true,
          comment: true,
          createdAt: true,
        },
      },
    },
  });
}

export async function getEventRatingSummary(eventId: string) {
  const result = await prisma.eventRating.aggregate({
    where: { eventId, approved: true },
    _avg: { rating: true },
    _count: { rating: true },
  });

  return {
    average: result._avg.rating ?? 0,
    count: result._count.rating,
  };
}

export async function getRelatedEvents(
  eventId: string,
  category: EventCategory,
  take = 3,
) {
  const sameCategory = await prisma.event.findMany({
    where: {
      published: true,
      category,
      id: { not: eventId },
      startsAt: { gte: upcomingFrom() },
    },
    orderBy: { startsAt: "asc" },
    take,
    select: eventCardSelect,
  });

  if (sameCategory.length >= take) return markPrivate(sameCategory);

  // Completamos con los proximos de cualquier categoria.
  const fill = await prisma.event.findMany({
    where: {
      published: true,
      id: { notIn: [eventId, ...sameCategory.map((event) => event.id)] },
      startsAt: { gte: upcomingFrom() },
    },
    orderBy: { startsAt: "asc" },
    take: take - sameCategory.length,
    select: eventCardSelect,
  });

  return markPrivate([...sameCategory, ...fill]);
}

export function getAllEventSlugs() {
  return prisma.event.findMany({
    where: { published: true },
    select: { slug: true, updatedAt: true },
    orderBy: { startsAt: "desc" },
  });
}

// --- Carta -------------------------------------------------------------------

export type MenuCategoryWithProducts = Awaited<
  ReturnType<typeof getMenu>
>[number];

export function getMenu() {
  return prisma.menuCategory.findMany({
    where: { active: true },
    orderBy: { position: "asc" },
    include: {
      products: {
        where: { available: true },
        orderBy: [{ position: "asc" }, { name: "asc" }],
      },
    },
  });
}

export function getFeaturedProducts(take = 6) {
  return prisma.menuProduct.findMany({
    where: { available: true, featured: true, category: { active: true } },
    orderBy: { position: "asc" },
    take,
    include: { category: { select: { name: true, slug: true } } },
  });
}

// --- Galeria -----------------------------------------------------------------

export function getGallery(take = 60) {
  return prisma.galleryImage.findMany({
    where: { active: true },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    take,
    include: { event: { select: { slug: true, title: true } } },
  });
}

export function getFeaturedGallery(take = 8) {
  return prisma.galleryImage.findMany({
    where: { active: true, featured: true },
    orderBy: { position: "asc" },
    take,
  });
}

// --- BarzuCard ---------------------------------------------------------------

export function getActivePromotions() {
  const now = new Date();

  return prisma.promotion.findMany({
    where: {
      active: true,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gte: now } }],
    },
    orderBy: { position: "asc" },
    // El nombre del producto o la categoria se muestra en la tarjeta publica:
    // "20% off" no dice nada; "20% off en cervezas" si.
    include: {
      product: { select: { name: true } },
      category: { select: { name: true } },
    },
  });
}
