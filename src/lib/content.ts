import "server-only";

import { cache } from "react";

import { dateOnlyKey, dayKey } from "@/lib/format";

import type { EventAccess, EventCategory } from "@/generated/prisma/enums";
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
  access: true,
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

/** Lo que se lee cuando un evento es privado y el dia no dice por que. */
const PRIVATE_FALLBACK = "Evento privado";

/**
 * El motivo por el que un evento no es para cualquiera, o null si lo es.
 *
 * El dia manda por defecto, pero el evento puede desmarcarse: el mismo dia
 * puede haber un cumpleaños arrendado y, aparte, la banda de siempre tocando
 * para el publico. El cierre es del cumpleaños; la banda se marca `PUBLICO` y
 * sigue anunciandose como abierta.
 */
export async function getEventPrivateReason(event: {
  startsAt: Date;
  access: EventAccess;
}) {
  const cerrados = await getClosedDayMap();
  return privateReasonFor(event, cerrados);
}

function privateReasonFor(
  event: { startsAt: Date; access: EventAccess },
  cerrados: Map<string, string>,
) {
  if (event.access === "PUBLICO") return null;

  const delDia = cerrados.get(dayKey(event.startsAt)) ?? null;

  if (event.access === "PRIVADO") return delDia ?? PRIVATE_FALLBACK;

  return delDia;
}

/**
 * Marca los eventos que no son para cualquiera.
 *
 * Un show privado no se esconde: se muestra diciendo que lo es. El local gana
 * con eso —el flyer sigue a la vista y quien lo mira se entera de que el sitio
 * se puede arrendar—, y quien pensaba ir se ahorra el viaje. Esconderlo dejaba
 * a esa persona sin ninguna de las dos cosas.
 *
 * Se resuelve aca, en la capa de datos, para que la marca llegue igual a la
 * portada, a la cartelera, al calendario y a la ficha del evento sin que cada
 * pantalla tenga que acordarse de preguntar.
 */
async function markPrivate<T extends { startsAt: Date; access: EventAccess }>(
  events: T[],
) {
  const cerrados = await getClosedDayMap();

  return events.map((event) => ({
    ...event,
    /** Motivo ("Evento privado"), o null si cualquiera puede entrar. */
    privateReason: privateReasonFor(event, cerrados),
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

/**
 * Para quien se arma la carta.
 *
 * - `publica`: la vitrina de la web, que ve cualquiera. Deja fuera los
 *   productos y las secciones marcados como no publicos (ver
 *   `MenuProduct.publicMenu` y `MenuCategory.publicMenu`).
 * - `mesa`: la carta del QR que esta sobre la mesa. Es de puertas adentro y
 *   lleva todo lo que se vende, igual que el POS de los garzones.
 */
export type MenuScope = "publica" | "mesa";

/**
 * La carta agrupada por categoria.
 *
 * El ambito por omision es el publico —el mas restrictivo— a proposito: una
 * pantalla nueva que olvide declararlo muestra de menos, nunca de mas, que es
 * el error que se puede corregir sin que lo haya visto media ciudad.
 */
export async function getMenu(scope: MenuScope = "publica") {
  const publica = scope === "publica";

  const categories = await prisma.menuCategory.findMany({
    // Una seccion apagada para la web se lleva a sus productos con ella: no
    // hace falta —ni serviria— repasarlos uno por uno.
    where: publica ? { active: true, publicMenu: true } : { active: true },
    orderBy: { position: "asc" },
    include: {
      products: {
        where: publica
          ? { available: true, publicMenu: true }
          : { available: true },
        orderBy: [{ position: "asc" }, { name: "asc" }],
      },
    },
  });

  /*
   * Una categoria sin productos no se dibuja.
   *
   * Antes no podia pasar casi nunca; ahora si: una categoria entera puede
   * quedar fuera de la vitrina publica producto por producto. Sin este filtro,
   * la web mostraria su nombre en la barra de secciones y una seccion vacia
   * debajo — que es peor que no mostrarla. Vale igual para la carta de la mesa
   * cuando se acaba todo lo de una seccion. Es lo mismo que ya hace la carta
   * del POS (ver `getPosMenu`).
   */
  return categories.filter((category) => category.products.length > 0);
}

/** Los destacados de la portada. Portada es vitrina: solo lo publico. */
export function getFeaturedProducts(take = 6) {
  return prisma.menuProduct.findMany({
    where: {
      available: true,
      featured: true,
      publicMenu: true,
      category: { active: true, publicMenu: true },
    },
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
