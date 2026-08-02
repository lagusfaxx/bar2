"use server";

import { redirect } from "next/navigation";

import { requireCmsUser } from "@/lib/auth";
import { revalidateContent } from "@/lib/cache";
import { formError, formSuccess, type FormState } from "@/lib/form-state";
import { prisma } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/utils";
import { eventSchema, fieldErrors, parsePriceToCents } from "@/lib/validation";

import { recordAudit } from "./audit";

/**
 * Convierte el valor de un <input type="datetime-local"> (hora de pared, sin
 * zona) al instante correspondiente en la zona horaria del local. Sin esto, la
 * hora cargada por el administrador se guardaria como UTC y el sitio la
 * mostraria corrida.
 */
function parseVenueDateTime(value: string): Date {
  const timeZone = process.env.NEXT_PUBLIC_TIME_ZONE ?? "America/Montevideo";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);

  if (!match) {
    throw new Error("Fecha inválida");
  }

  const [, year, month, day, hour, minute] = match.map(Number) as number[];
  const guess = Date.UTC(year!, month! - 1, day!, hour!, minute!);

  // Diferencia entre la zona del local y UTC en ese instante.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(new Date(guess))
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );

  return new Date(guess - (asUtc - guess));
}

export async function saveEvent(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireCmsUser();

  const id = formData.get("id");
  const eventId = typeof id === "string" && id ? id : null;

  const parsed = eventSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisá los datos del evento.", fieldErrors(parsed.error));
  }

  const input = parsed.data;

  let startsAt: Date;
  try {
    startsAt = parseVenueDateTime(input.startsAt);
  } catch {
    return formError("La fecha del evento no es válida.", {
      startsAt: "Indicá una fecha y hora válidas",
    });
  }

  let priceCents: number | null = null;
  if (!input.isFree && input.price) {
    try {
      priceCents = parsePriceToCents(input.price);
    } catch {
      return formError("El precio no es válido.", { price: "Precio inválido" });
    }
  }

  const slug = await uniqueSlug(input.slug || input.title, async (candidate) => {
    const found = await prisma.event.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    return !!found && found.id !== eventId;
  });

  const data = {
    slug,
    title: input.title,
    artist: input.artist || null,
    category: input.category,
    excerpt: input.excerpt || null,
    description: input.description || null,
    posterUrl: input.posterUrl || null,
    coverUrl: input.coverUrl || null,
    startsAt,
    doorsAt: input.doorsAt ? parseVenueDateTime(input.doorsAt) : null,
    endsAt: input.endsAt ? parseVenueDateTime(input.endsAt) : null,
    isFree: input.isFree,
    priceCents,
    ticketUrl: input.ticketUrl || null,
    capacity: input.capacity ? Number(input.capacity) : null,
    published: input.published,
    featured: input.featured,
    ratingLock: input.ratingLock,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
    ogImageUrl: input.ogImageUrl || null,
  };

  const saved = eventId
    ? await prisma.event.update({ where: { id: eventId }, data })
    : await prisma.event.create({ data });

  await recordAudit(session.userId, eventId ? "update" : "create", "Event", saved.id, saved.title);

  revalidateContent("events");

  if (!eventId) {
    redirect(`/admin/eventos/${saved.id}?creado=1`);
  }

  return formSuccess("Evento guardado.");
}

export async function toggleEventPublished(id: string, published: boolean) {
  const session = await requireCmsUser();

  const event = await prisma.event.update({
    where: { id },
    data: { published },
    select: { title: true },
  });

  await recordAudit(
    session.userId,
    "update",
    "Event",
    id,
    `${published ? "Publicado" : "Despublicado"}: ${event.title}`,
  );

  revalidateContent("events");
}

export async function toggleEventFeatured(id: string, featured: boolean) {
  const session = await requireCmsUser();

  const event = await prisma.event.update({
    where: { id },
    data: { featured },
    select: { title: true },
  });

  await recordAudit(
    session.userId,
    "update",
    "Event",
    id,
    `${featured ? "Destacado" : "Sin destacar"}: ${event.title}`,
  );

  revalidateContent("events");
}

export async function deleteEvent(id: string) {
  const session = await requireCmsUser();

  const event = await prisma.event.delete({
    where: { id },
    select: { title: true },
  });

  await recordAudit(session.userId, "delete", "Event", id, event.title);

  revalidateContent("events");
  redirect("/admin/eventos");
}
