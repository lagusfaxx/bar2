"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { formError, formSuccess, type FormState } from "@/lib/form-state";
import {
  nextQueuePosition,
  rememberSearch,
  searchCatalog,
  upsertTrack,
} from "@/lib/karaoke";
import { prisma } from "@/lib/prisma";
import {
  fieldErrors,
  karaokeQueueSchema,
  karaokeSearchSchema,
} from "@/lib/validation";
import { searchKaraokeVideos } from "@/lib/youtube";

/**
 * Karaoke: todo lo que escribe el encargado.
 *
 * La noche la maneja el publico —las mesas eligen y entran solas a la cola—,
 * asi que nada de aca es un paso obligatorio del karaoke: es la baranda. Sirve
 * para reordenar, sacar lo que no corresponde, cargarle la cancion a quien no
 * tiene telefono y podar el catalogo.
 *
 * Exige sesion del panel, igual que el POS. Lo que si esta abierto a internet
 * —buscar y mandar una cancion desde la mesa— vive en `actions/public.ts` con
 * sus limites.
 */

/** Las tres pantallas que miran esto: el tablero, la TV y el QR de las mesas. */
function refresh() {
  revalidatePath("/staff/karaoke");
  revalidatePath("/staff/karaoke/pantalla");
  revalidatePath("/karaoke");
}

// --- Buscar ------------------------------------------------------------------

/**
 * Catalogo del local: gratis y al instante.
 *
 * Es lo primero que se ofrece al cargar una cancion. Recien si no esta aca se
 * gasta una busqueda de YouTube.
 */
export async function searchLocalCatalog(query: string): Promise<FormState> {
  await requireStaff();

  const tracks = await searchCatalog(query, 12);

  return formSuccess(
    tracks.length > 0
      ? `${tracks.length} en el catálogo del local.`
      : "No está en el catálogo del local todavía.",
    { tracks },
  );
}

/**
 * Busqueda en YouTube. Cuesta 100 de las 10.000 unidades diarias.
 *
 * Lo que devuelve queda guardado en el catalogo del local en el momento, sin
 * esperar a que alguien lo encole: si el encargado tuvo que pagar por esta
 * busqueda, que al menos las mesas se la encuentren gratis despues.
 */
export async function searchYoutube(query: string): Promise<FormState> {
  await requireStaff();

  const parsed = karaokeSearchSchema.safeParse({ query });

  if (!parsed.success) {
    return formError("Escribe la canción que buscas.", fieldErrors(parsed.error));
  }

  const result = await searchKaraokeVideos(parsed.data.query);

  if (!result.ok) return formError(result.message);

  await rememberSearch(parsed.data.query, result.videos);

  return formSuccess(
    result.videos.length > 0
      ? `${result.videos.length} resultado(s) en YouTube.`
      : "YouTube no devolvió karaokes para esa búsqueda.",
    { videos: result.videos },
  );
}

// --- Cola --------------------------------------------------------------------

/** Carga un turno desde la pantalla del encargado. */
export async function queueSong(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireStaff();

  const parsed = karaokeQueueSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa los datos del turno.", fieldErrors(parsed.error));
  }

  const { videoId, title, channel, durationSeconds, thumbnailUrl, singer, tableId, note } =
    parsed.data;

  await prisma.$transaction(async (tx) => {
    const track = await upsertTrack(tx, {
      videoId,
      title,
      channel,
      durationSeconds,
      thumbnailUrl,
    });

    await tx.karaokeTrack.update({
      where: { id: track.id },
      data: { timesQueued: { increment: 1 }, lastQueuedAt: new Date() },
    });

    await tx.karaokeEntry.create({
      data: {
        trackId: track.id,
        singer,
        tableId: tableId || null,
        note: note || null,
        source: "SALA",
        status: "EN_COLA",
        position: await nextQueuePosition(tx),
        queuedById: user.userId,
      },
    });
  });

  refresh();
  return formSuccess(`${singer} quedó en la cola.`);
}

/**
 * Acepta una pedida de mesa que ya tiene video.
 *
 * Las que llegaron escritas a mano no pasan por aca: hay que buscarles el
 * video primero con `resolveRequest`, porque sin video la TV no puede
 * reproducir nada.
 */
export async function acceptRequest(entryId: string): Promise<FormState> {
  await requireStaff();

  const entry = await prisma.karaokeEntry.findUnique({
    where: { id: entryId },
    select: { status: true, trackId: true, singer: true },
  });

  if (!entry) return formError("Ese pedido ya no está.");
  if (entry.status !== "PEDIDA") return formError("Ese pedido ya se resolvió.");

  if (!entry.trackId) {
    return formError(
      "Este pedido vino escrito a mano: búscale el video antes de aceptarlo.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.karaokeEntry.update({
      where: { id: entryId },
      data: { status: "EN_COLA", position: await nextQueuePosition(tx) },
    });

    await tx.karaokeTrack.update({
      where: { id: entry.trackId! },
      data: { timesQueued: { increment: 1 }, lastQueuedAt: new Date() },
    });
  });

  refresh();
  return formSuccess(`${entry.singer} pasó a la cola.`);
}

/** Le asigna un video a una pedida escrita a mano y la manda a la cola. */
export async function resolveRequest(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const entryId = String(formData.get("entryId") ?? "");
  const parsed = karaokeQueueSchema
    .omit({ singer: true, tableId: true, note: true })
    .safeParse(Object.fromEntries(formData));

  if (!entryId || !parsed.success) {
    return formError("Elige el video para este pedido.");
  }

  const entry = await prisma.karaokeEntry.findUnique({
    where: { id: entryId },
    select: { status: true, singer: true },
  });

  if (!entry) return formError("Ese pedido ya no está.");
  if (entry.status !== "PEDIDA") return formError("Ese pedido ya se resolvió.");

  const { videoId, title, channel, durationSeconds, thumbnailUrl } = parsed.data;

  await prisma.$transaction(async (tx) => {
    const track = await upsertTrack(tx, {
      videoId,
      title,
      channel,
      durationSeconds,
      thumbnailUrl,
    });

    await tx.karaokeTrack.update({
      where: { id: track.id },
      data: { timesQueued: { increment: 1 }, lastQueuedAt: new Date() },
    });

    await tx.karaokeEntry.update({
      where: { id: entryId },
      data: {
        trackId: track.id,
        status: "EN_COLA",
        position: await nextQueuePosition(tx),
      },
    });
  });

  refresh();
  return formSuccess(`${entry.singer} pasó a la cola.`);
}

/** Saca un turno de la cola: se arrepintieron, se fueron, o no era karaoke. */
export async function discardEntry(entryId: string): Promise<FormState> {
  await requireStaff();

  const entry = await prisma.karaokeEntry.findUnique({
    where: { id: entryId },
    select: { status: true, singer: true },
  });

  if (!entry) return formError("Ese turno ya no está.");

  await prisma.karaokeEntry.update({
    where: { id: entryId },
    data: { status: "DESCARTADA", endedAt: new Date() },
  });

  refresh();
  return formSuccess(`Turno de ${entry.singer} descartado.`);
}

/**
 * Sube o baja un turno.
 *
 * Intercambia posiciones con el vecino en vez de renumerar la cola entera:
 * asi dos garzones moviendo cosas a la vez no se pisan mas alla del par que
 * cada uno toca.
 */
export async function moveEntry(
  entryId: string,
  direction: "arriba" | "abajo",
): Promise<FormState> {
  await requireStaff();

  const entry = await prisma.karaokeEntry.findUnique({
    where: { id: entryId },
    select: { id: true, position: true, status: true, singer: true },
  });

  if (!entry) return formError("Ese turno ya no está.");
  if (entry.status !== "EN_COLA") {
    return formError("Solo se pueden mover los turnos que están esperando.");
  }

  const neighbour = await prisma.karaokeEntry.findFirst({
    where: {
      status: "EN_COLA",
      position:
        direction === "arriba"
          ? { lt: entry.position }
          : { gt: entry.position },
    },
    orderBy: { position: direction === "arriba" ? "desc" : "asc" },
    select: { id: true, position: true },
  });

  if (!neighbour) {
    return formSuccess(
      direction === "arriba"
        ? `${entry.singer} ya es el primero.`
        : `${entry.singer} ya es el último.`,
    );
  }

  await prisma.$transaction([
    prisma.karaokeEntry.update({
      where: { id: entry.id },
      data: { position: neighbour.position },
    }),
    prisma.karaokeEntry.update({
      where: { id: neighbour.id },
      data: { position: entry.position },
    }),
  ]);

  refresh();
  return formSuccess(`${entry.singer} ${direction === "arriba" ? "sube" : "baja"}.`);
}

/**
 * Pone a alguien a cantar ahora.
 *
 * Lo que estuviera sonando queda como cantado: en una noche real el turno
 * anterior siempre termina, aunque sea a mitad de cancion porque la gente
 * aplaudio antes.
 */
export async function startEntry(entryId: string): Promise<FormState> {
  await requireStaff();

  const entry = await prisma.karaokeEntry.findUnique({
    where: { id: entryId },
    select: { status: true, singer: true, trackId: true },
  });

  if (!entry) return formError("Ese turno ya no está.");
  if (!entry.trackId) return formError("Ese turno todavía no tiene video.");
  if (entry.status === "CANTANDO") return formSuccess("Ya está cantando.");

  await prisma.$transaction([
    prisma.karaokeEntry.updateMany({
      where: { status: "CANTANDO" },
      data: { status: "CANTADA", endedAt: new Date() },
    }),
    prisma.karaokeEntry.update({
      where: { id: entryId },
      data: { status: "CANTANDO", startedAt: new Date() },
    }),
  ]);

  refresh();
  return formSuccess(`Canta ${entry.singer}.`);
}

/**
 * Cierra el turno actual y arranca el siguiente.
 *
 * La llama sola la pantalla de la TV cuando el video termina, asi el karaoke
 * corre sin que nadie tenga que tocar nada entre cancion y cancion. Cada paso
 * es un `updateMany` condicionado al estado: si la pantalla y el encargado
 * disparan a la vez, el segundo no encuentra nada que cambiar en vez de
 * saltarse un turno.
 */
export async function playNext(): Promise<FormState> {
  await requireStaff();

  const current = await prisma.karaokeEntry.findFirst({
    where: { status: "CANTANDO" },
    select: { id: true },
  });

  if (current) {
    await prisma.karaokeEntry.updateMany({
      where: { id: current.id, status: "CANTANDO" },
      data: { status: "CANTADA", endedAt: new Date() },
    });
  }

  const next = await prisma.karaokeEntry.findFirst({
    where: { status: "EN_COLA", trackId: { not: null } },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, singer: true },
  });

  if (!next) {
    refresh();
    return formSuccess("No queda nadie en la cola.");
  }

  const taken = await prisma.karaokeEntry.updateMany({
    where: { id: next.id, status: "EN_COLA" },
    data: { status: "CANTANDO", startedAt: new Date() },
  });

  refresh();

  return taken.count > 0
    ? formSuccess(`Canta ${next.singer}.`)
    : formSuccess("El turno ya lo tomó otra pantalla.");
}

/** Saca una cancion del catalogo sin borrar el historial. */
export async function blockTrack(trackId: string): Promise<FormState> {
  await requireStaff();

  const track = await prisma.karaokeTrack.update({
    where: { id: trackId },
    data: { blocked: true },
    select: { title: true },
  });

  refresh();
  return formSuccess(`"${track.title}" ya no aparece en las búsquedas.`);
}

// --- Interruptor de la noche -------------------------------------------------

/**
 * Abre o cierra el karaoke.
 *
 * Cerrado, el QR de las mesas avisa que hoy no hay en vez de aceptar pedidos
 * que nadie va a mirar. Es una decision de la noche, no un ajuste del sitio:
 * por eso se maneja desde la pantalla del encargado y no desde el panel.
 */
export async function setKaraokeOpen(open: boolean): Promise<FormState> {
  await requireStaff();

  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", karaokeOpen: open },
    update: { karaokeOpen: open },
  });

  refresh();
  return formSuccess(
    open
      ? "Karaoke abierto: las mesas ya pueden pedir."
      : "Karaoke cerrado: las mesas ven que hoy no hay.",
  );
}
