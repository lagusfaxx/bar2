"use server";

import { revalidatePath } from "next/cache";

import { fingerprint, getMemberSession } from "@/lib/auth";
import { getSettings } from "@/lib/content";
import { destinatariosDeAviso, sendEmail } from "@/lib/email";
import { contactNotification } from "@/lib/email-templates";
import {
  findSongsForGuest,
  nextQueuePosition,
  queueLength,
} from "@/lib/karaoke";
import { revalidateContent } from "@/lib/cache";
import { formError, formSuccess, type FormState } from "@/lib/form-state";
import { prisma } from "@/lib/prisma";
import { clientIp, clientUserAgent, rateLimit } from "@/lib/rate-limit";
import {
  contactSchema,
  eventRatingSchema,
  fieldErrors,
  karaokeRequestSchema,
} from "@/lib/validation";

/**
 * Acciones publicas del sitio. Al ser invocables por POST directo, cada una
 * valida y limita las peticiones por su cuenta, sin confiar en el formulario.
 */

export async function submitContactMessage(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ip = await clientIp();
  const limit = rateLimit(`contact:${ip}`, 5, 60 * 15);

  if (!limit.ok) {
    return formError(
      "Recibimos varios mensajes desde esta conexión. Prueba de nuevo en unos minutos.",
    );
  }

  const parsed = contactSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa los datos del formulario.", fieldErrors(parsed.error));
  }

  const { website, ...data } = parsed.data;

  // El campo trampa solo lo completan los bots: respondemos como si todo
  // hubiera salido bien, pero no guardamos nada.
  if (website) {
    return formSuccess("¡Gracias! Te vamos a responder a la brevedad.");
  }

  await prisma.contactMessage.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      subject: data.subject || null,
      message: data.message,
    },
  });

  /*
   * El aviso al local.
   *
   * Va despues de guardar y sin cortar el flujo a proposito: el mensaje ya esta
   * a salvo en la base y visible en el panel. Si el correo no sale —clave sin
   * configurar, Resend caido, dominio sin verificar— se anota el fallo en
   * `email_logs` y la persona que escribio igual ve que su mensaje se envio,
   * porque se envio. Lo contrario seria decirle a un cliente que su consulta
   * fallo por un problema que no es suyo y que ni siquiera es cierto.
   */
  const settings = await getSettings();
  const avisar = destinatariosDeAviso(settings.notifyEmails);

  if (avisar.length > 0) {
    const { subject, html } = contactNotification({
      barName: settings.barName,
      logoUrl: settings.logoUrl,
      nombre: data.name,
      email: data.email,
      telefono: data.phone || null,
      asunto: data.subject || null,
      mensaje: data.message,
    });

    await sendEmail({
      to: avisar,
      subject,
      html,
      kind: "CONTACTO",
      // Responder el aviso le escribe a quien consulto, sin copiar direcciones
      // a mano ni tener que entrar al panel.
      replyTo: data.email,
    });
  }

  return formSuccess("¡Gracias por escribirnos! Te respondemos a la brevedad.");
}

export async function submitEventRating(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ip = await clientIp();
  const limit = rateLimit(`rating:${ip}`, 8, 60 * 30);

  if (!limit.ok) {
    return formError("Demasiadas calificaciones seguidas. Prueba más tarde.");
  }

  const parsed = eventRatingSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa tu calificación.", fieldErrors(parsed.error));
  }

  const { website, eventId, authorName, rating, comment } = parsed.data;

  if (website) {
    return formSuccess("¡Gracias por tu calificación!");
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, published: true },
    select: { id: true, ratingLock: true, startsAt: true },
  });

  if (!event) {
    return formError("No encontramos ese evento.");
  }

  if (event.ratingLock) {
    return formError("Las calificaciones de este evento están cerradas.");
  }

  // Solo tiene sentido calificar un show al que ya se pudo asistir.
  if (event.startsAt > new Date()) {
    return formError(
      "Podrás calificar este evento una vez que se haya realizado.",
    );
  }

  const mark = fingerprint(ip, await clientUserAgent());

  const existing = await prisma.eventRating.findUnique({
    where: { eventId_fingerprint: { eventId, fingerprint: mark } },
    select: { id: true },
  });

  if (existing) {
    return formError("Ya dejaste tu calificación para este evento. ¡Gracias!");
  }

  await prisma.eventRating.create({
    data: {
      eventId,
      authorName,
      rating,
      comment: comment || null,
      fingerprint: mark,
      // Las reseñas se publican después de una revisión desde el panel.
      approved: false,
    },
  });

  revalidateContent("events");

  return formSuccess("¡Gracias! Tu calificación se publica apenas la revisemos.");
}

/**
 * El socio avisa que transfirió el valor de su tarjeta física.
 *
 * No confirma nada por sí solo: dejar el aviso solo mueve la tarjeta a
 * "transferencia informada" para que el local la revise contra su banco y la
 * confirme desde el panel.
 */
export async function reportCardTransfer(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await getMemberSession();

  if (!session) {
    return formError("Vuelve a iniciar sesión para avisar tu transferencia.");
  }

  const ip = await clientIp();
  const limit = rateLimit(`transfer:${ip}`, 10, 60 * 15);

  if (!limit.ok) {
    return formError("Demasiados avisos seguidos. Prueba de nuevo en un rato.");
  }

  const reference = String(formData.get("paymentReference") ?? "")
    .trim()
    .slice(0, 120);

  const card = await prisma.barzuCard.findUnique({
    where: { memberId: session.memberId },
    select: { id: true, paymentStatus: true },
  });

  if (!card) {
    return formError("No encontramos tu tarjeta.");
  }

  if (card.paymentStatus === "PAID" || card.paymentStatus === "DELIVERED") {
    return formSuccess("Tu pago ya estaba confirmado.");
  }

  await prisma.barzuCard.update({
    where: { id: card.id },
    data: {
      paymentStatus: "REPORTED",
      reportedAt: new Date(),
      paymentReference: reference || null,
    },
  });

  revalidatePath("/barzucard/tarjeta");

  return formSuccess(
    "¡Gracias! Vamos a revisar la transferencia y te avisamos cuando la tarjeta esté lista para retirar.",
  );
}

/** Cuantas canciones esperando le toca a cada mesa. */
const MAX_POR_MESA = 3;

/** Tope de la cola: mas que esto es prometer un turno que no va a llegar. */
const MAX_EN_COLA = 30;

/** Las tres pantallas que miran la cola. */
function refreshKaraoke() {
  revalidatePath("/karaoke");
  revalidatePath("/staff/karaoke");
  revalidatePath("/staff/karaoke/pantalla");
}

/**
 * A quien se le cuentan los limites del karaoke.
 *
 * No a la conexion: en un bar todo el mundo esta en el mismo wifi, o sea en
 * una sola IP, y limitar por ahi seria cerrarle el karaoke al local entero
 * cuando la sexta persona de la noche manda su cancion. La unidad natural es
 * la mesa, que ademas es la que aparece en el QR. La IP queda igual como
 * techo lejano, contra el que escribe un script en vez de cantar.
 */
function quienPide(tableNumber: number | undefined, ip: string) {
  return tableNumber ? `mesa:${tableNumber}` : `ip:${ip}`;
}

/**
 * Una mesa manda su cancion a la cola.
 *
 * Es la unica accion de karaoke abierta a internet y la que hace que la noche
 * corra sola: lo que se elige aca entra directo a la cola, y la pantalla lo
 * reproduce cuando le toca sin que nadie de sala intervenga.
 *
 * Que entre sola no significa que entre cualquier cosa. La mesa elige por
 * `trackId` una cancion que ya esta en el catalogo del local —el buscador la
 * guarda ahi antes de mostrarla—, asi que el navegador nunca manda un video ni
 * un titulo: eso lo pone el servidor. Sala sigue pudiendo sacar un turno o
 * podar una version del catalogo, pero mirando, no atendiendo.
 *
 * Los topes son lo que reemplaza al criterio de una persona:
 *
 * - Tres canciones por mesa esperando, para que una mesa entusiasta no se
 *   adueñe de la noche.
 * - Una cola maxima, para no prometerle a nadie un turno que no va a llegar.
 * - Un limite por conexion, contra el que insiste desde el sillon de su casa.
 */
export async function queueKaraokeSong(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = karaokeRequestSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa tu pedido.", fieldErrors(parsed.error));
  }

  const { website, singer, tableNumber, trackId, requestText } = parsed.data;

  const ip = await clientIp();
  const propio = rateLimit(`karaoke:${quienPide(tableNumber, ip)}`, 6, 60 * 15);
  const techo = rateLimit(`karaoke-ip:${ip}`, 60, 60 * 15);

  if (!propio.ok || !techo.ok) {
    return formError(
      "Ya mandaste varias canciones seguidas. Espera unos minutos o pídeselo al garzón.",
    );
  }

  // Campo trampa: solo lo completan los bots.
  if (website) {
    return formSuccess("Te llamamos por el micrófono cuando sea tu turno.");
  }

  const settings = await prisma.siteSettings.findUnique({
    where: { id: "singleton" },
    select: { karaokeOpen: true },
  });

  if (!settings?.karaokeOpen) {
    return formError("El karaoke no está abierto en este momento.");
  }

  if (!trackId && !requestText) {
    return formError("Elige una canción de la lista o escribe cuál quieres.");
  }

  const table = tableNumber
    ? await prisma.posTable.findUnique({
        where: { number: tableNumber },
        select: { id: true },
      })
    : null;

  if (tableNumber && !table) {
    return formError(`No encontramos la mesa ${tableNumber}.`);
  }

  if (table) {
    const pendientes = await prisma.karaokeEntry.count({
      where: { tableId: table.id, status: { in: ["PEDIDA", "EN_COLA"] } },
    });

    if (pendientes >= MAX_POR_MESA) {
      return formError(
        "Tu mesa ya tiene tres canciones esperando. Cuando pase alguna, puedes mandar otra.",
      );
    }
  }

  if ((await queueLength()) >= MAX_EN_COLA) {
    return formError(
      "La cola está llena por ahora. Prueba de nuevo en un rato: se va moviendo rápido.",
    );
  }

  // La cancion elegida tiene que existir y estar habilitada: el id viaja por
  // el formulario y no se puede confiar en el.
  const track = trackId
    ? await prisma.karaokeTrack.findFirst({
        where: { id: trackId, blocked: false },
        select: { id: true },
      })
    : null;

  if (trackId && !track) {
    return formError("Esa canción ya no está disponible. Elige otra.");
  }

  /*
   * Con video, a la cola. Sin video —la mesa la escribio a mano porque no la
   * encontro— queda como pedida y sala le busca el video: es la unica puerta
   * que todavia pasa por una persona, y justamente por eso el buscador hace
   * todo lo posible por no llegar hasta aca.
   */
  const turno = await prisma.$transaction(async (tx) => {
    if (!track) {
      await tx.karaokeEntry.create({
        data: {
          requestText: requestText || null,
          singer,
          tableId: table?.id ?? null,
          status: "PEDIDA",
          source: "MESA",
        },
      });

      return null;
    }

    await tx.karaokeTrack.update({
      where: { id: track.id },
      data: { timesQueued: { increment: 1 }, lastQueuedAt: new Date() },
    });

    await tx.karaokeEntry.create({
      data: {
        trackId: track.id,
        singer,
        tableId: table?.id ?? null,
        status: "EN_COLA",
        source: "MESA",
        position: await nextQueuePosition(tx),
      },
    });

    const [enCola, cantando] = await Promise.all([
      tx.karaokeEntry.count({ where: { status: "EN_COLA" } }),
      tx.karaokeEntry.count({ where: { status: "CANTANDO" } }),
    ]);

    return { enCola, cantando: cantando > 0 };
  });

  refreshKaraoke();

  if (turno === null) {
    return formSuccess(
      "No encontramos el video, así que se la dejamos anotada al equipo. Te llamamos por el micrófono.",
      { estado: "pedida" },
    );
  }

  return formSuccess(delante(turno), {
    estado: "en-cola",
    posicion: turno.enCola,
  });
}

/**
 * Lo unico que quiere saber quien acaba de mandar su cancion: cuanto falta.
 *
 * La cuenta se hace ya estando adentro de la cola, y aparte se mira si hay
 * alguien con el microfono: quedar solo en la cola con la pantalla vacia
 * significa que arranca en segundos, y con alguien cantando, que es el que
 * sigue.
 */
function delante({ enCola, cantando }: { enCola: number; cantando: boolean }) {
  if (enCola <= 1) {
    return cantando
      ? "Eres el próximo. Mira la pantalla."
      : "¡Vas ahora! Mira la pantalla.";
  }

  const antes = enCola - 1;

  return `Quedaste ${enCola}º en la cola: ${antes} antes que tú${
    cantando ? ", más quien está cantando" : ""
  }.`;
}

/**
 * Buscador de las mesas.
 *
 * Primero el catalogo del local, gratis e instantaneo; si de ahi sale poco, se
 * le pregunta a YouTube una vez y lo que vuelve queda guardado para siempre.
 * El limite por conexion de aca es el que evita que alguien con la URL y un
 * script se lleve el presupuesto de busquedas de toda la noche.
 */
export async function searchKaraokeSongs(
  query: string,
  /** La mesa del QR: es a ella, y no al wifi del local, a quien se le cuenta. */
  tableNumber?: number,
): Promise<FormState> {
  const ip = await clientIp();
  const quien = quienPide(tableNumber, ip);

  const propio = rateLimit(`karaoke-buscar:${quien}`, 40, 60 * 5);
  const techo = rateLimit(`karaoke-buscar-ip:${ip}`, 400, 60 * 5);

  if (!propio.ok || !techo.ok) {
    return formError("Demasiadas búsquedas seguidas. Espera un momento.");
  }

  const { tracks, notice } = await findSongsForGuest(
    String(query ?? "").slice(0, 120),
    () => rateLimit(`karaoke-youtube:${quien}`, 8, 60 * 15).ok,
  );

  return formSuccess(notice ?? "", { tracks });
}
