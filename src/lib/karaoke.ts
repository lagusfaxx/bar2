import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { KaraokeEntryStatus, KaraokeSource } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { searchKaraokeVideos, youtubeConfigured } from "@/lib/youtube";

/**
 * Karaoke: catalogo del local y cola de la noche.
 *
 * El karaoke es de autoservicio: la mesa busca su cancion, la elige y entra
 * sola a la cola; la pantalla arranca la primera y sigue con la siguiente sin
 * que nadie toque nada. Sala no es un paso obligatorio —mira, reordena y saca
 * lo que no corresponda, pero la noche corre igual si no mira—.
 *
 * Casi todo lo de aca son lecturas; las escrituras viven en
 * `app/actions/karaoke.ts` y `app/actions/public.ts`. Las excepciones son las
 * dos que sirven a las dos: `upsertTrack`, que guarda un video en el catalogo,
 * y `findSongsForGuest`, que busca para una mesa y de paso deja guardado lo
 * que encontro.
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
    select: {
      id: true,
      number: true,
      name: true,
      zone: { select: { name: true } },
    },
  });
}

// --- Catalogo y cola, compartido entre sala y las mesas ----------------------

type TrackInput = {
  videoId: string;
  title: string;
  channel?: string | null;
  durationSeconds?: number | null;
  thumbnailUrl?: string | null;
};

/**
 * Guarda un video en el catalogo del local.
 *
 * Es lo que hace que la cuota alcance: cada video que se busca o se encola
 * queda aca, y la proxima vez que alguien pida esa cancion sale del catalogo
 * sin tocar la API.
 */
export async function upsertTrack(
  tx: Prisma.TransactionClient,
  input: TrackInput,
) {
  const data = {
    title: input.title,
    channel: input.channel || null,
    durationSeconds: input.durationSeconds ?? null,
    thumbnailUrl: input.thumbnailUrl || null,
    search: searchKey(input.title, input.channel),
  };

  return tx.karaokeTrack.upsert({
    where: { videoId: input.videoId },
    create: { videoId: input.videoId, ...data },
    update: data,
    select: trackSelect,
  });
}

/** Siguiente lugar libre al final de la cola. */
export async function nextQueuePosition(tx: Prisma.TransactionClient) {
  const last = await tx.karaokeEntry.findFirst({
    where: { status: { in: ["EN_COLA", "CANTANDO"] } },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  return (last?.position ?? 0) + 1;
}

/** Cuantos turnos hay esperando ahora mismo. */
export async function queueLength() {
  return prisma.karaokeEntry.count({ where: { status: "EN_COLA" } });
}

// --- Buscar desde la mesa ----------------------------------------------------

/**
 * Cuantas busquedas de YouTube se permiten por dia.
 *
 * La cuota real son 10.000 unidades y cada busqueda cuesta 100, o sea cien.
 * Se reservan veinte para el encargado, que es quien resuelve el caso raro
 * cuando una mesa no encuentra lo suyo.
 */
const YOUTUBE_BUDGET = 80;

/** Cuanto vale una busqueda ya pagada antes de volver a pagarla. */
const SEARCH_TTL_DAYS = 30;

/** Con menos resultados propios que esto, vale la pena preguntarle a YouTube. */
const ENOUGH_FROM_CATALOG = 4;

export type GuestSearch = {
  tracks: KaraokeTrackView[];
  /** Para contarle a la mesa por que no hay mas, cuando no hay mas. */
  notice: string | null;
};

/** Busquedas pagadas en las ultimas 24 horas. */
async function youtubeSpentToday() {
  return prisma.karaokeSearch.count({
    where: { updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
}

/**
 * Guarda lo que costo una busqueda de YouTube.
 *
 * Los videos pasan a ser catalogo del local y la frase queda anotada como
 * pagada, asi que la proxima vez que alguien la escriba —una mesa o el
 * encargado— sale de la base sin gastar cuota. Se anota aunque no haya vuelto
 * ningun video: una frase sin karaokes tampoco los va a tener manana, y si se
 * deja sin anotar se paga de nuevo en cada intento.
 *
 * Devuelve las canciones ya guardadas, releidas de la base en vez de
 * reenviadas tal cual: una version que el local habia sacado del catalogo
 * tiene que seguir afuera aunque YouTube la devuelva.
 */
export async function rememberSearch(
  query: string,
  videos: TrackInput[],
): Promise<KaraokeTrackView[]> {
  const key = searchKey(query);

  if (key.length < 2) return [];

  await prisma.karaokeSearch.upsert({
    where: { key },
    create: { key },
    update: { hits: { increment: 1 } },
  });

  if (videos.length === 0) return [];

  await prisma.$transaction((tx) =>
    Promise.all(videos.map((video) => upsertTrack(tx, video))),
  );

  return prisma.karaokeTrack.findMany({
    where: {
      blocked: false,
      videoId: { in: videos.map((video) => video.videoId) },
    },
    select: trackSelect,
  });
}

/**
 * Lo que ve una mesa cuando escribe el nombre de una cancion.
 *
 * Primero el catalogo del local, que es gratis e instantaneo. Solo si de ahi
 * sale poco —y si esa misma frase no se pago hace poco, y si queda
 * presupuesto del dia— se le pregunta a YouTube, y todo lo que vuelve queda
 * guardado en el catalogo: la busqueda se paga una vez y sirve para siempre.
 *
 * Devuelve canciones del catalogo, nunca videos sueltos, y por eso la mesa
 * elige por `id`. Asi la accion que encola no tiene que creerle al navegador
 * ni un titulo ni un identificador de video.
 */
export async function findSongsForGuest(
  query: string,
  /** Presupuesto propio de quien busca: evita que uno solo gaste el del local. */
  allowYoutube: () => boolean,
): Promise<GuestSearch> {
  const key = searchKey(query);

  if (key.length < 2) return { tracks: [], notice: null };

  const own = await searchCatalog(query, 12);

  if (own.length >= ENOUGH_FROM_CATALOG) return { tracks: own, notice: null };

  const seen = await prisma.karaokeSearch.findUnique({
    where: { key },
    select: { updatedAt: true },
  });

  // Ya se pago hace poco: lo que YouTube tenia para esta frase ya esta en el
  // catalogo, y volver a preguntar seria pagar dos veces por lo mismo.
  const fresh =
    seen &&
    seen.updatedAt.getTime() > Date.now() - SEARCH_TTL_DAYS * 86400 * 1000;

  if (fresh) {
    await prisma.karaokeSearch.update({
      where: { key },
      data: { hits: { increment: 1 } },
    });

    return { tracks: own, notice: null };
  }

  if (!youtubeConfigured()) return { tracks: own, notice: null };

  if ((await youtubeSpentToday()) >= YOUTUBE_BUDGET || !allowYoutube()) {
    return {
      tracks: own,
      notice:
        "Hoy ya se usaron las búsquedas nuevas del local. Elige de la lista o pídesela al garzón.",
    };
  }

  const result = await searchKaraokeVideos(query);

  /*
   * El motivo exacto de la falla es cosa del local, no de la mesa: al cliente
   * le sirve saber que hacer ahora —elegir otra o dejarla escrita—, no que la
   * clave de la API esta vencida.
   */
  if (!result.ok) {
    return {
      tracks: own,
      notice:
        result.reason === "sin-cuota"
          ? "Hoy ya se usaron las búsquedas nuevas del local. Elige de la lista o déjala escrita."
          : "No pudimos buscar fuera de la lista del local en este momento. Elige de la lista o déjala escrita.",
    };
  }

  const saved = await rememberSearch(query, result.videos);
  const known = new Set(own.map((track) => track.id));

  return {
    tracks: [...own, ...saved.filter((track) => !known.has(track.id))],
    notice: null,
  };
}
