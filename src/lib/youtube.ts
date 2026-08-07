import "server-only";

/**
 * Busqueda de videos de karaoke en YouTube.
 *
 * Usa la Data API v3 con una clave de servidor (`YOUTUBE_API_KEY`). Dos cosas
 * que conviene tener claras antes de tocar este archivo:
 *
 * 1. La cuota es chica y cara. Son 10.000 unidades al dia y `search.list`
 *    cuesta 100: cien busquedas y se acabo hasta la medianoche del Pacifico.
 *    Por eso quien busca aca es solo el encargado, nunca la pagina del QR de
 *    las mesas, y todo lo que se encuentra queda guardado en `KaraokeTrack`
 *    para no volver a pagarlo.
 *
 * 2. YouTube Premium no se conecta por codigo. No existe credencial que meta
 *    una suscripcion en un reproductor incrustado: los avisos dependen de la
 *    sesion del navegador que mira. Si la TV del local tiene iniciada la
 *    cuenta Premium del bar, la reproduccion sale sin avisos; si no, no hay
 *    nada que este archivo pueda hacer al respecto.
 */

const SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

/** Corta la espera: la pantalla del encargado no puede quedarse colgada. */
const TIMEOUT_MS = 8000;

export type YoutubeVideo = {
  videoId: string;
  title: string;
  channel: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
};

export type YoutubeSearchResult =
  | { ok: true; videos: YoutubeVideo[] }
  | { ok: false; reason: "sin-clave" | "sin-cuota" | "error"; message: string };

export function youtubeConfigured() {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

/**
 * Duracion ISO 8601 (`PT4M13S`) a segundos.
 *
 * Sirve para avisar en la cola cuanto dura el turno y para descartar de una
 * los videos de tres horas: eso no es una cancion, es una recopilacion.
 */
function parseDuration(value: string | undefined): number | null {
  if (!value) return null;

  const match = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  if (!match) return null;

  const [, days, hours, minutes, seconds] = match;

  return (
    Number(days ?? 0) * 86400 +
    Number(hours ?? 0) * 3600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0)
  );
}

async function call(url: URL): Promise<Response> {
  return fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    // La respuesta se guarda en la base, no en el cache de Next: lo que
    // importa que no se repita es el gasto de cuota, y de eso se encarga el
    // catalogo propio.
    cache: "no-store",
  });
}

/**
 * Traduce el error de la API a algo que el encargado pueda leer sin abrir la
 * consola. `quotaExceeded` es el unico que importa de verdad: no es una falla,
 * es que hoy ya no quedan busquedas.
 */
async function apiError(response: Response): Promise<YoutubeSearchResult> {
  let reason: "sin-cuota" | "error" = "error";
  let detail = `HTTP ${response.status}`;

  try {
    const body = await response.json();
    const first = body?.error?.errors?.[0]?.reason as string | undefined;

    if (first === "quotaExceeded" || first === "dailyLimitExceeded") {
      reason = "sin-cuota";
    }
    detail = body?.error?.message ?? detail;
  } catch {
    /* respuesta sin JSON: nos quedamos con el codigo HTTP */
  }

  if (reason === "sin-cuota") {
    return {
      ok: false,
      reason,
      message:
        "Se acabó la cuota de búsquedas de YouTube por hoy. Las canciones que ya están en el catálogo del local siguen funcionando.",
    };
  }

  return {
    ok: false,
    reason,
    message: `YouTube no respondió la búsqueda (${detail}).`,
  };
}

/**
 * Busca karaokes para una cancion.
 *
 * Se pide explicitamente que el video sea incrustable y sindicable: un video
 * que solo se puede ver en youtube.com se encola igual de bien y despues deja
 * la pantalla en negro con la gente esperando con el microfono en la mano.
 */
export async function searchKaraokeVideos(
  query: string,
): Promise<YoutubeSearchResult> {
  const key = process.env.YOUTUBE_API_KEY;

  if (!key) {
    return {
      ok: false,
      reason: "sin-clave",
      message:
        "Falta configurar YOUTUBE_API_KEY en el servidor. Sin ella solo se puede elegir del catálogo del local.",
    };
  }

  const search = new URL(SEARCH_URL);
  search.searchParams.set("key", key);
  search.searchParams.set("part", "snippet");
  search.searchParams.set("type", "video");
  search.searchParams.set("maxResults", "10");
  search.searchParams.set("videoEmbeddable", "true");
  search.searchParams.set("videoSyndicated", "true");
  search.searchParams.set("safeSearch", "moderate");
  // Nadie escribe "karaoke" al pedir su cancion, pero es lo que hay que buscar.
  search.searchParams.set(
    "q",
    /karaoke/i.test(query) ? query : `${query} karaoke`,
  );

  let response: Response;

  try {
    response = await call(search);
  } catch {
    return {
      ok: false,
      reason: "error",
      message: "No se pudo llegar a YouTube. Revisa la conexión del local.",
    };
  }

  if (!response.ok) return apiError(response);

  const body = await response.json();

  const ids: string[] = (body.items ?? [])
    .map((item: { id?: { videoId?: string } }) => item.id?.videoId)
    .filter(Boolean);

  if (ids.length === 0) return { ok: true, videos: [] };

  /*
   * Segunda llamada, por la duracion.
   *
   * `search.list` no la trae, y sin duracion no se puede ni avisar cuanto
   * falta para el turno de alguien ni filtrar las recopilaciones de una hora.
   * Cuesta 1 unidad contra las 100 de la busqueda: es practicamente gratis.
   */
  const details = new URL(VIDEOS_URL);
  details.searchParams.set("key", key);
  details.searchParams.set("part", "contentDetails,snippet,status");
  details.searchParams.set("id", ids.join(","));

  let detailResponse: Response;

  try {
    detailResponse = await call(details);
  } catch {
    return {
      ok: false,
      reason: "error",
      message: "No se pudo llegar a YouTube. Revisa la conexión del local.",
    };
  }

  if (!detailResponse.ok) return apiError(detailResponse);

  const detailBody = await detailResponse.json();

  type Item = {
    id: string;
    snippet?: {
      title?: string;
      channelTitle?: string;
      thumbnails?: Record<string, { url?: string }>;
    };
    contentDetails?: { duration?: string };
    status?: { embeddable?: boolean };
  };

  const videos: YoutubeVideo[] = (detailBody.items ?? [])
    .filter((item: Item) => item.status?.embeddable !== false)
    .map((item: Item) => ({
      videoId: item.id,
      title: item.snippet?.title ?? "Sin título",
      channel: item.snippet?.channelTitle ?? null,
      durationSeconds: parseDuration(item.contentDetails?.duration),
      thumbnailUrl:
        item.snippet?.thumbnails?.medium?.url ??
        item.snippet?.thumbnails?.default?.url ??
        null,
    }))
    // Una pista de karaoke dura entre minuto y medio y doce minutos. Fuera de
    // ese rango es un recopilatorio, una lista entera o un video cortado.
    .filter(
      (video: YoutubeVideo) =>
        video.durationSeconds === null ||
        (video.durationSeconds >= 90 && video.durationSeconds <= 720),
    );

  return { ok: true, videos };
}
