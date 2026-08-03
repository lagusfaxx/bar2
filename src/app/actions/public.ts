"use server";

import { revalidatePath } from "next/cache";

import { fingerprint, getMemberSession } from "@/lib/auth";
import { revalidateContent } from "@/lib/cache";
import { formError, formSuccess, type FormState } from "@/lib/form-state";
import { prisma } from "@/lib/prisma";
import { clientIp, clientUserAgent, rateLimit } from "@/lib/rate-limit";
import { contactSchema, eventRatingSchema, fieldErrors } from "@/lib/validation";

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
