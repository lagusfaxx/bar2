"use server";

import { revalidatePath } from "next/cache";

import { fingerprint, getMemberSession } from "@/lib/auth";
import { getSettings } from "@/lib/content";
import { destinatariosDeAviso, sendEmail } from "@/lib/email";
import { contactNotification } from "@/lib/email-templates";
import { searchCatalog } from "@/lib/karaoke";
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

/**
 * Pedido de karaoke desde el QR de la mesa.
 *
 * Es la unica accion de karaoke abierta a internet, y por eso es la mas
 * restringida de las tres pantallas:
 *
 * - No busca en YouTube. El cliente elige del catalogo del local o escribe su
 *   cancion con palabras; buscar cuesta cuota de la API y no se le regala a
 *   cualquiera que abra la URL.
 * - No entra a la cola. Queda como PEDIDA hasta que sala la acepta, que es lo
 *   que evita que la TV termine reproduciendo cualquier cosa.
 * - Tiene tope por mesa, para que una mesa entusiasta no se adueñe de la noche.
 */
export async function requestKaraokeSong(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ip = await clientIp();
  const limit = rateLimit(`karaoke:${ip}`, 6, 60 * 15);

  if (!limit.ok) {
    return formError(
      "Ya mandaste varios pedidos seguidos. Espera unos minutos o pídeselo al garzón.",
    );
  }

  const parsed = karaokeRequestSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa tu pedido.", fieldErrors(parsed.error));
  }

  const { website, singer, tableNumber, trackId, requestText } = parsed.data;

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

    if (pendientes >= 3) {
      return formError(
        "Tu mesa ya tiene tres canciones esperando. Cuando pase alguna, puedes pedir otra.",
      );
    }
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

  await prisma.karaokeEntry.create({
    data: {
      trackId: track?.id ?? null,
      requestText: track ? null : requestText || null,
      singer,
      tableId: table?.id ?? null,
      status: "PEDIDA",
      source: "MESA",
    },
  });

  revalidatePath("/staff/karaoke");

  return formSuccess(
    "Apenas el equipo la revise quedas en la cola, y te llamamos por el micrófono cuando sea tu turno.",
  );
}

/**
 * Buscador del catalogo para la pagina de las mesas.
 *
 * Consulta la base del local y nada mas: la API de YouTube no se toca desde
 * afuera. Sin eso, cualquiera con la URL podria quemar la cuota diaria del
 * local en un minuto.
 */
export async function searchKaraokeCatalog(query: string): Promise<FormState> {
  const ip = await clientIp();
  const limit = rateLimit(`karaoke-buscar:${ip}`, 40, 60 * 5);

  if (!limit.ok) {
    return formError("Demasiadas búsquedas seguidas. Espera un momento.");
  }

  const tracks = await searchCatalog(String(query ?? "").slice(0, 120), 12);

  return formSuccess("", { tracks });
}
