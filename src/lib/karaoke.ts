import "server-only";

import type { KaraokeEntryStatus, KaraokeSource } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/**
 * Karaoke: catalogo del local y cola de la noche.
 *
 * Las lecturas viven aca; las escrituras, en `app/actions/karaoke.ts`.
 *
 * La cola es una lista con un solo turno CANTANDO a la vez. El orden lo da
 * `position` y no la hora de llegada, porque el encargado necesita poder subir
 * a alguien —el del cumpleaños, la mesa que se va— sin borrar y volver a
 * cargar.
 */

/** Texto contra el que busca el catalogo propio: sin tildes y en minuscula. */
export function searchKey(...parts: Array<string | null | undefined>) {
  return parts
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type KaraokeTrackView = {
  id: string;
  videoId: string;
  title: string;
  channel: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  timesQueued: number;
};

export type KaraokeEntryView = {
  id: string;
  status: KaraokeEntryStatus;
  source: KaraokeSource;
  position: number;
  singer: string;
  note: string | null;
  /** Lo que escribio quien pidio desde la mesa, cuando todavia no hay video. */
  requestText: string | null;
  tableNumber: number | null;
  track: KaraokeTrackView | null;
  createdAt: string;
  startedAt: string | null;
};

const trackSelect = {
  id: true,
  videoId: true,
  title: true,
  channel: true,
  durationSeconds: true,
  thumbnailUrl: true,
  timesQueued: true,
} as const;

const entrySelect = {
  id: true,
  status: true,
  source: true,
  position: true,
  singer: true,
  note: true,
  requestText: true,
  createdAt: true,
  startedAt: true,
  table: { select: { number: true } },
  track: { select: trackSelect },
} as const;

type EntryRow = {
  id: string;
  status: KaraokeEntryStatus;
  source: KaraokeSource;
  position: number;
  singer: string;
  note: string | null;
  requestText: string | null;
  createdAt: Date;
  startedAt: Date | null;
  table: { number: number } | null;
  track: KaraokeTrackView | null;
};

function toEntryView(entry: EntryRow): KaraokeEntryView {
  return {
    id: entry.id,
    status: entry.status,
    source: entry.source,
    position: entry.position,
    singer: entry.singer,
    note: entry.note,
    requestText: entry.requestText,
    tableNumber: entry.table?.number ?? null,
    track: entry.track,
    createdAt: entry.createdAt.toISOString(),
    startedAt: entry.startedAt?.toISOString() ?? null,
  };
}

export type KaraokeBoard = {
  open: boolean;
  singing: KaraokeEntryView | null;
  queue: KaraokeEntryView[];
  /** Pedidas desde las mesas, esperando que sala las acepte. */
  requests: KaraokeEntryView[];
  /** Ya cantadas esta noche, de la mas reciente hacia atras. */
  done: KaraokeEntryView[];
};

/** Desde cuando cuenta "esta noche": la jornada arranca a las 6 de la tarde. */
function nightStart() {
  const now = new Date();
  const start = new Date(now);

  start.setHours(18, 0, 0, 0);
  // Antes de las seis todavia se esta mirando la noche que recien termina.
  if (now < start) start.setDate(start.getDate() - 1);

  return start;
}

export async function getKaraokeBoard(): Promise<KaraokeBoard> {
  const [settings, entries] = await Promise.all([
    prisma.siteSettings.findUnique({
      where: { id: "singleton" },
      select: { karaokeOpen: true },
    }),
    prisma.karaokeEntry.findMany({
      where: {
        OR: [
          { status: { in: ["PEDIDA", "EN_COLA", "CANTANDO"] } },
          { status: "CANTADA", endedAt: { gte: nightStart() } },
        ],
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: entrySelect,
    }),
  ]);

  const views = entries.map(toEntryView);

  return {
    open: settings?.karaokeOpen ?? false,
    singing: views.find((entry) => entry.status === "CANTANDO") ?? null,
    queue: views.filter((entry) => entry.status === "EN_COLA"),
    requests: views.filter((entry) => entry.status === "PEDIDA"),
    done: views
      .filter((entry) => entry.status === "CANTADA")
      .reverse()
      .slice(0, 12),
  };
}

/**
 * Lo que necesita la pantalla de la TV: quien canta y quienes siguen.
 *
 * Va aparte del tablero del encargado a proposito: la TV no tiene por que
 * cargar las pedidas pendientes ni el historial, y se refresca cada pocos
 * segundos toda la noche.
 */
export async function getKaraokeScreen() {
  const entries = await prisma.karaokeEntry.findMany({
    where: { status: { in: ["CANTANDO", "EN_COLA"] } },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    take: 8,
    select: entrySelect,
  });

  const views = entries.map(toEntryView);

  return {
    singing: views.find((entry) => entry.status === "CANTANDO") ?? null,
    // Solo las que tienen video: la TV no puede reproducir un pedido escrito
    // a mano que sala todavia no resolvio.
    queue: views.filter((entry) => entry.status === "EN_COLA" && entry.track),
  };
}

/**
 * Catalogo del local.
 *
 * Es la unica busqueda que ve el cliente desde el QR de su mesa: no toca la
 * API de YouTube, asi que no gasta cuota y no se puede abusar desde afuera.
 * Sin texto devuelve lo mas cantado, que es un buen punto de partida cuando
 * alguien abre la pagina sin saber que pedir.
 */
export async function searchCatalog(query: string, take = 12) {
  const key = searchKey(query);

  return prisma.karaokeTrack.findMany({
    where: {
      blocked: false,
      ...(key ? { search: { contains: key } } : {}),
    },
    orderBy: [{ timesQueued: "desc" }, { title: "asc" }],
    take,
    select: trackSelect,
  });
}

/** Cuantas pedidas sin resolver arrastra una mesa. */
export async function pendingRequestsForTable(tableId: string) {
  return prisma.karaokeEntry.count({
    where: { tableId, status: { in: ["PEDIDA", "EN_COLA"] } },
  });
}

/** Mesas activas, para elegir desde el QR y para imprimir los codigos. */
export async function getKaraokeTables() {
  return prisma.posTable.findMany({
    where: { active: true },
    orderBy: [{ position: "asc" }, { number: "asc" }],
    select: { id: true, number: true, name: true, zone: true },
  });
}
