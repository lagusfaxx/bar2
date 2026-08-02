import "server-only";

import { unstable_cache } from "next/cache";

import type { EventCategory } from "@/generated/prisma/enums";
import { TAGS } from "@/lib/cache";
import { prisma } from "@/lib/prisma";

/**
 * Consultas de contenido publico. Todas pasan por unstable_cache con una
 * etiqueta, de modo que el CMS pueda invalidarlas al guardar (ver lib/cache.ts).
 */

const HOUR = 60 * 60;

// --- Ajustes del sitio -------------------------------------------------------

export type SiteSettings = NonNullable<
  Awaited<ReturnType<typeof loadSettings>>
>;

async function loadSettings() {
  const existing = await prisma.siteSettings.findUnique({
    where: { id: "singleton" },
  });

  if (existing) return existing;

  // Primer arranque sin seed: creamos la fila con los valores por defecto del
  // schema para que la web nunca quede sin contenido.
  return prisma.siteSettings.create({ data: { id: "singleton" } });
}

export const getSettings = unstable_cache(loadSettings, ["site-settings"], {
  tags: [TAGS.settings],
  revalidate: HOUR * 12,
});

export const getSocialLinks = unstable_cache(
  () =>
    prisma.socialLink.findMany({
      where: { active: true },
      orderBy: { position: "asc" },
    }),
  ["social-links"],
  { tags: [TAGS.social], revalidate: HOUR * 12 },
);

export const getOpeningHours = unstable_cache(
  () => prisma.openingHour.findMany({ orderBy: { dayOfWeek: "asc" } }),
  ["opening-hours"],
  { tags: [TAGS.hours], revalidate: HOUR * 12 },
);

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
 * Un evento sigue considerandose "proximo" durante la madrugada siguiente:
 * un show del sabado 23:00 no debe desaparecer de la cartelera a medianoche.
 */
function upcomingFrom() {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 6);
  return cutoff;
}

export const getUpcomingEvents = unstable_cache(
  async (take = 24) =>
    prisma.event.findMany({
      where: { published: true, startsAt: { gte: upcomingFrom() } },
      orderBy: { startsAt: "asc" },
      take,
      select: eventCardSelect,
    }),
  ["events-upcoming"],
  { tags: [TAGS.events], revalidate: 300 },
);

export const getFeaturedEvents = unstable_cache(
  async (take = 3) =>
    prisma.event.findMany({
      where: {
        published: true,
        featured: true,
        startsAt: { gte: upcomingFrom() },
      },
      orderBy: { startsAt: "asc" },
      take,
      select: eventCardSelect,
    }),
  ["events-featured"],
  { tags: [TAGS.events], revalidate: 300 },
);

export const getPastEvents = unstable_cache(
  async (take = 12) =>
    prisma.event.findMany({
      where: { published: true, startsAt: { lt: upcomingFrom() } },
      orderBy: { startsAt: "desc" },
      take,
      select: eventCardSelect,
    }),
  ["events-past"],
  { tags: [TAGS.events], revalidate: HOUR },
);

/** Eventos publicados de un mes concreto, para pintar el calendario. */
export const getEventsForMonth = unstable_cache(
  async (year: number, month: number) => {
    const from = new Date(Date.UTC(year, month, 1));
    const to = new Date(Date.UTC(year, month + 1, 1));

    return prisma.event.findMany({
      where: { published: true, startsAt: { gte: from, lt: to } },
      orderBy: { startsAt: "asc" },
      select: eventCardSelect,
    });
  },
  ["events-month"],
  { tags: [TAGS.events], revalidate: 300 },
);

/** Rango amplio de eventos publicados: alimenta el calendario del cliente. */
export const getEventsInRange = unstable_cache(
  async (fromIso: string, toIso: string) =>
    prisma.event.findMany({
      where: {
        published: true,
        startsAt: { gte: new Date(fromIso), lt: new Date(toIso) },
      },
      orderBy: { startsAt: "asc" },
      select: eventCardSelect,
    }),
  ["events-range"],
  { tags: [TAGS.events], revalidate: 300 },
);

export const getEventBySlug = unstable_cache(
  async (slug: string) =>
    prisma.event.findFirst({
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
    }),
  ["event-by-slug"],
  { tags: [TAGS.events], revalidate: 300 },
);

export const getEventRatingSummary = unstable_cache(
  async (eventId: string) => {
    const result = await prisma.eventRating.aggregate({
      where: { eventId, approved: true },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return {
      average: result._avg.rating ?? 0,
      count: result._count.rating,
    };
  },
  ["event-rating-summary"],
  { tags: [TAGS.events], revalidate: 300 },
);

export const getRelatedEvents = unstable_cache(
  async (eventId: string, category: EventCategory, take = 3) => {
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

    if (sameCategory.length >= take) return sameCategory;

    // Completamos con los proximos de cualquier categoria.
    const fill = await prisma.event.findMany({
      where: {
        published: true,
        id: { notIn: [eventId, ...sameCategory.map((e) => e.id)] },
        startsAt: { gte: upcomingFrom() },
      },
      orderBy: { startsAt: "asc" },
      take: take - sameCategory.length,
      select: eventCardSelect,
    });

    return [...sameCategory, ...fill];
  },
  ["events-related"],
  { tags: [TAGS.events], revalidate: HOUR },
);

export const getAllEventSlugs = unstable_cache(
  async () =>
    prisma.event.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
      orderBy: { startsAt: "desc" },
    }),
  ["event-slugs"],
  { tags: [TAGS.events], revalidate: HOUR },
);

// --- Carta -------------------------------------------------------------------

export type MenuCategoryWithProducts = Awaited<
  ReturnType<typeof getMenu>
>[number];

export const getMenu = unstable_cache(
  async () =>
    prisma.menuCategory.findMany({
      where: { active: true },
      orderBy: { position: "asc" },
      include: {
        products: {
          where: { available: true },
          orderBy: [{ position: "asc" }, { name: "asc" }],
        },
      },
    }),
  ["menu"],
  { tags: [TAGS.menu], revalidate: HOUR * 6 },
);

export const getFeaturedProducts = unstable_cache(
  async (take = 6) =>
    prisma.menuProduct.findMany({
      where: { available: true, featured: true, category: { active: true } },
      orderBy: { position: "asc" },
      take,
      include: { category: { select: { name: true, slug: true } } },
    }),
  ["menu-featured"],
  { tags: [TAGS.menu], revalidate: HOUR * 6 },
);

// --- Galeria -----------------------------------------------------------------

export const getGallery = unstable_cache(
  async (take = 60) =>
    prisma.galleryImage.findMany({
      where: { active: true },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
      take,
      include: { event: { select: { slug: true, title: true } } },
    }),
  ["gallery"],
  { tags: [TAGS.gallery], revalidate: HOUR * 6 },
);

export const getFeaturedGallery = unstable_cache(
  async (take = 8) =>
    prisma.galleryImage.findMany({
      where: { active: true, featured: true },
      orderBy: { position: "asc" },
      take,
    }),
  ["gallery-featured"],
  { tags: [TAGS.gallery], revalidate: HOUR * 6 },
);

// --- BarzuCard ---------------------------------------------------------------

export const getActivePromotions = unstable_cache(
  async () => {
    const now = new Date();

    return prisma.promotion.findMany({
      where: {
        active: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      orderBy: { position: "asc" },
    });
  },
  ["promotions-active"],
  { tags: [TAGS.promotions], revalidate: 300 },
);
