"use server";

import { fingerprint } from "@/lib/auth";
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
