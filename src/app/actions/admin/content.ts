"use server";

import { requireAdmin, requireCmsUser, hashPassword } from "@/lib/auth";
import { revalidateContent } from "@/lib/cache";
import { formError, formSuccess, type FormState } from "@/lib/form-state";
import { prisma } from "@/lib/prisma";
import {
  deleteUpload,
  saveUpload,
  saveVideoUpload,
  UploadError,
  type UploadPreset,
} from "@/lib/uploads";
import { uniqueSlug } from "@/lib/utils";
import {
  fieldErrors,
  galleryImageSchema,
  openingHourSchema,
  parsePriceToCents,
  promotionSchema,
  settingsSchema,
  socialLinkSchema,
  userSchema,
} from "@/lib/validation";

import { recordAudit } from "./audit";

// --- Subida de imágenes ------------------------------------------------------

export async function uploadImage(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireCmsUser();

  const file = formData.get("file");
  const preset = (formData.get("preset") as UploadPreset) ?? "gallery";

  if (!(file instanceof File)) {
    return formError("No se recibió ningún archivo.");
  }

  try {
    const result = await saveUpload(file, preset);
    return formSuccess("Imagen subida.", { url: result.url });
  } catch (error) {
    if (error instanceof UploadError) {
      return formError(error.message);
    }
    return formError("No pudimos subir la imagen. Prueba de nuevo.");
  }
}

/** Sube el video de la portada. Se guarda tal cual: no se transcodifica. */
export async function uploadVideo(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireCmsUser();

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return formError("No se recibió ningún archivo.");
  }

  try {
    const result = await saveVideoUpload(file);
    return formSuccess("Video subido.", { url: result.url });
  } catch (error) {
    if (error instanceof UploadError) {
      return formError(error.message);
    }
    return formError("No pudimos subir el video. Prueba de nuevo.");
  }
}

export async function removeMedia(url: string) {
  await requireCmsUser();
  await deleteUpload(url);
}

// --- Galería -----------------------------------------------------------------

export async function saveGalleryImage(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireCmsUser();

  const rawId = formData.get("id");
  const imageId = typeof rawId === "string" && rawId ? rawId : null;

  const parsed = galleryImageSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa los datos de la imagen.", fieldErrors(parsed.error));
  }

  const input = parsed.data;

  const data = {
    url: input.url,
    alt: input.alt,
    caption: input.caption || null,
    tag: input.tag || null,
    eventId: input.eventId || null,
    featured: input.featured,
    active: input.active,
  };

  if (imageId) {
    await prisma.galleryImage.update({ where: { id: imageId }, data });
  } else {
    const last = await prisma.galleryImage.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
    });

    await prisma.galleryImage.create({
      data: { ...data, position: (last?.position ?? -1) + 1 },
    });
  }

  await recordAudit(
    session.userId,
    imageId ? "update" : "create",
    "GalleryImage",
    imageId ?? undefined,
    input.alt,
  );

  revalidateContent("gallery");
  return formSuccess("Imagen guardada.");
}

export async function deleteGalleryImage(id: string) {
  const session = await requireCmsUser();

  const image = await prisma.galleryImage.delete({
    where: { id },
    select: { url: true, alt: true },
  });

  // Si la imagen vivía en el volumen de subidas, se borra también del disco.
  await deleteUpload(image.url);

  await recordAudit(session.userId, "delete", "GalleryImage", id, image.alt);
  revalidateContent("gallery");
}

export async function toggleGalleryImage(
  id: string,
  field: "active" | "featured",
  value: boolean,
) {
  await requireCmsUser();
  await prisma.galleryImage.update({ where: { id }, data: { [field]: value } });
  revalidateContent("gallery");
}

export async function moveGalleryImage(id: string, direction: "up" | "down") {
  await requireCmsUser();

  const current = await prisma.galleryImage.findUnique({
    where: { id },
    select: { id: true, position: true },
  });

  if (!current) return;

  const neighbour = await prisma.galleryImage.findFirst({
    where:
      direction === "up"
        ? { position: { lt: current.position } }
        : { position: { gt: current.position } },
    orderBy: { position: direction === "up" ? "desc" : "asc" },
    select: { id: true, position: true },
  });

  if (!neighbour) return;

  await prisma.$transaction([
    prisma.galleryImage.update({
      where: { id: current.id },
      data: { position: neighbour.position },
    }),
    prisma.galleryImage.update({
      where: { id: neighbour.id },
      data: { position: current.position },
    }),
  ]);

  revalidateContent("gallery");
}

// --- Promociones -------------------------------------------------------------

export async function savePromotion(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireCmsUser();

  const rawId = formData.get("id");
  const promotionId = typeof rawId === "string" && rawId ? rawId : null;

  const raw = Object.fromEntries(formData);
  const parsed = promotionSchema.safeParse({
    ...raw,
    // Los días llegan como varias entradas con el mismo nombre.
    availableWeekdays: formData.getAll("availableWeekdays"),
  });

  if (!parsed.success) {
    return formError("Revisa los datos de la promoción.", fieldErrors(parsed.error));
  }

  const input = parsed.data;

  // Para descuentos de monto fijo el valor se ingresa en pesos, no en puntos.
  let value = 0;
  if (input.type === "PERCENT_OFF") {
    value = Math.min(100, Math.max(0, Number(input.value ?? 0)));
  } else if (input.type === "AMOUNT_OFF") {
    try {
      value = parsePriceToCents(input.value || "0");
    } catch {
      return formError("El monto del descuento no es válido.", {
        value: "Monto inválido",
      });
    }
  }

  const slug = await uniqueSlug(input.slug || input.title, async (candidate) => {
    const found = await prisma.promotion.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    return !!found && found.id !== promotionId;
  });

  const data = {
    slug,
    title: input.title,
    description: input.description,
    terms: input.terms || null,
    imageUrl: input.imageUrl || null,
    type: input.type,
    value,
    startsAt: new Date(input.startsAt),
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    active: input.active,
    minTier: input.minTier,
    maxPerCard: input.maxPerCard,
    maxTotal: input.maxTotal,
    pointsCost: input.pointsCost,
    pointsReward: input.pointsReward,
    availableWeekdays: input.availableWeekdays,
  };

  if (promotionId) {
    await prisma.promotion.update({ where: { id: promotionId }, data });
  } else {
    const last = await prisma.promotion.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
    });

    await prisma.promotion.create({
      data: { ...data, position: (last?.position ?? -1) + 1 },
    });
  }

  await recordAudit(
    session.userId,
    promotionId ? "update" : "create",
    "Promotion",
    promotionId ?? undefined,
    input.title,
  );

  revalidateContent("promotions");
  return formSuccess("Promoción guardada.");
}

export async function deletePromotion(id: string) {
  const session = await requireCmsUser();

  const promotion = await prisma.promotion.delete({
    where: { id },
    select: { title: true },
  });

  await recordAudit(session.userId, "delete", "Promotion", id, promotion.title);
  revalidateContent("promotions");
}

export async function togglePromotion(id: string, active: boolean) {
  await requireCmsUser();
  await prisma.promotion.update({ where: { id }, data: { active } });
  revalidateContent("promotions");
}

// --- Ajustes del sitio -------------------------------------------------------

export async function saveSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireCmsUser();

  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa los ajustes.", fieldErrors(parsed.error));
  }

  const input = parsed.data;

  // Los campos opcionales vacíos se guardan como null, no como "".
  const nullable = <T extends string>(value: T | undefined) => value || null;

  let cardPriceCents: number | undefined;

  if (input.cardPrice) {
    try {
      cardPriceCents = parsePriceToCents(input.cardPrice);
    } catch {
      return formError("Revisa los ajustes.", {
        cardPrice: "Escribe solo el monto, por ejemplo 5.500",
      });
    }
  }

  // `cardPrice` es el texto del formulario; a la base va `cardPriceCents`.
  const settingsInput = { ...input, cardPrice: undefined };
  delete settingsInput.cardPrice;

  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...settingsInput, ...(cardPriceCents != null && { cardPriceCents }) },
    update: {
      barName: input.barName,
      tagline: input.tagline,
      logoUrl: nullable(input.logoUrl),
      logoAltUrl: nullable(input.logoAltUrl),
      faviconUrl: nullable(input.faviconUrl),

      heroTitle: input.heroTitle,
      heroEyebrow: nullable(input.heroEyebrow),
      heroSubtitle: nullable(input.heroSubtitle),
      heroImageUrl: nullable(input.heroImageUrl),
      heroImageMobileUrl: nullable(input.heroImageMobileUrl),
      heroVideoUrl: nullable(input.heroVideoUrl),
      heroCtaLabel: nullable(input.heroCtaLabel),
      heroCtaHref: nullable(input.heroCtaHref),
      heroCtaSecondaryLabel: nullable(input.heroCtaSecondaryLabel),
      heroCtaSecondaryHref: nullable(input.heroCtaSecondaryHref),
      heroVideoPosterUrl: nullable(input.heroVideoPosterUrl),

      marqueeText: nullable(input.marqueeText),
      homeEventsEyebrow: nullable(input.homeEventsEyebrow),
      homeEventsTitle: nullable(input.homeEventsTitle),
      homeEventsLead: nullable(input.homeEventsLead),
      homeMenuEyebrow: nullable(input.homeMenuEyebrow),
      homeMenuTitle: nullable(input.homeMenuTitle),
      homeMenuLead: nullable(input.homeMenuLead),
      homeLoyaltyTitle: nullable(input.homeLoyaltyTitle),
      homeGalleryEyebrow: nullable(input.homeGalleryEyebrow),
      homeGalleryTitle: nullable(input.homeGalleryTitle),
      homeGalleryLead: nullable(input.homeGalleryLead),
      homeLocationEyebrow: nullable(input.homeLocationEyebrow),
      homeLocationTitle: nullable(input.homeLocationTitle),

      aboutTitle: nullable(input.aboutTitle),
      aboutLead: nullable(input.aboutLead),
      aboutBody: nullable(input.aboutBody),
      aboutImageUrl: nullable(input.aboutImageUrl),
      aboutSecondaryImageUrl: nullable(input.aboutSecondaryImageUrl),

      address: input.address,
      addressCity: input.addressCity,
      latitude: input.latitude,
      longitude: input.longitude,
      phone: nullable(input.phone),
      whatsapp: nullable(input.whatsapp),
      email: nullable(input.email),

      reservationsNote: nullable(input.reservationsNote),
      footerNote: nullable(input.footerNote),

      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      seoImageUrl: nullable(input.seoImageUrl),
      seoKeywords: nullable(input.seoKeywords),
      googleAnalyticsId: nullable(input.googleAnalyticsId),

      loyaltyEnabled: input.loyaltyEnabled,
      loyaltyTitle: input.loyaltyTitle,
      loyaltyDescription: nullable(input.loyaltyDescription),
      loyaltyTerms: nullable(input.loyaltyTerms),

      ...(cardPriceCents != null && { cardPriceCents }),
      cardPaymentInfo: nullable(input.cardPaymentInfo),
      cardPickupInfo: nullable(input.cardPickupInfo),
    },
  });

  await recordAudit(session.userId, "update", "SiteSettings", "singleton", "Ajustes del sitio");
  revalidateContent();

  return formSuccess("Ajustes guardados. La web pública ya muestra los cambios.");
}

// --- Redes sociales ----------------------------------------------------------

export async function saveSocialLink(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireCmsUser();

  const rawId = formData.get("id");
  const linkId = typeof rawId === "string" && rawId ? rawId : null;

  const parsed = socialLinkSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa el enlace.", fieldErrors(parsed.error));
  }

  if (linkId) {
    await prisma.socialLink.update({ where: { id: linkId }, data: parsed.data });
  } else {
    const last = await prisma.socialLink.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
    });

    await prisma.socialLink.create({
      data: { ...parsed.data, position: (last?.position ?? -1) + 1 },
    });
  }

  revalidateContent("social");
  return formSuccess("Enlace guardado.");
}

export async function deleteSocialLink(id: string) {
  await requireCmsUser();
  await prisma.socialLink.delete({ where: { id } });
  revalidateContent("social");
}

// --- Horarios ----------------------------------------------------------------

export async function saveOpeningHours(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireCmsUser();

  for (let day = 0; day < 7; day++) {
    const parsed = openingHourSchema.safeParse({
      dayOfWeek: day,
      opensAt: formData.get(`opensAt-${day}`) ?? "",
      closesAt: formData.get(`closesAt-${day}`) ?? "",
      closed: formData.get(`closed-${day}`) === "on",
      note: formData.get(`note-${day}`) ?? "",
    });

    if (!parsed.success) {
      return formError("Revisa los horarios cargados.");
    }

    const value = parsed.data;
    const data = {
      opensAt: value.closed ? null : value.opensAt || null,
      closesAt: value.closed ? null : value.closesAt || null,
      closed: value.closed,
      note: value.note || null,
    };

    await prisma.openingHour.upsert({
      where: { dayOfWeek: day },
      create: { dayOfWeek: day, ...data },
      update: data,
    });
  }

  revalidateContent("hours");
  return formSuccess("Horarios guardados.");
}

// --- Moderación --------------------------------------------------------------

export async function setRatingApproval(id: string, approved: boolean) {
  await requireCmsUser();
  await prisma.eventRating.update({ where: { id }, data: { approved } });
  revalidateContent("events");
}

export async function deleteRating(id: string) {
  await requireCmsUser();
  await prisma.eventRating.delete({ where: { id } });
  revalidateContent("events");
}

export async function setMessageRead(id: string, read: boolean) {
  await requireCmsUser();
  await prisma.contactMessage.update({ where: { id }, data: { read } });
}

export async function archiveMessage(id: string) {
  await requireCmsUser();
  await prisma.contactMessage.update({
    where: { id },
    data: { archived: true, read: true },
  });
}

export async function deleteMessage(id: string) {
  await requireCmsUser();
  await prisma.contactMessage.delete({ where: { id } });
}

// --- Usuarios del panel ------------------------------------------------------

export async function saveUser(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireAdmin();

  const rawId = formData.get("id");
  const userId = typeof rawId === "string" && rawId ? rawId : null;

  const parsed = userSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa los datos del usuario.", fieldErrors(parsed.error));
  }

  const input = parsed.data;

  // Al crear, la contraseña es obligatoria; al editar, vacía significa "sin cambios".
  if (!userId && (!input.password || input.password.length < 8)) {
    return formError("La contraseña debe tener al menos 8 caracteres.", {
      password: "Mínimo 8 caracteres",
    });
  }

  if (userId && input.password && input.password.length < 8) {
    return formError("La contraseña debe tener al menos 8 caracteres.", {
      password: "Mínimo 8 caracteres",
    });
  }

  const duplicate = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (duplicate && duplicate.id !== userId) {
    return formError("Ya existe un usuario con ese email.", {
      email: "Email en uso",
    });
  }

  // Nadie puede quitarse a sí mismo el acceso y dejar el panel sin administrador.
  if (userId === session.userId && (input.role !== "ADMIN" || !input.active)) {
    return formError(
      "No puedes quitarte a ti mismo el rol de administrador ni desactivar tu cuenta.",
    );
  }

  if (userId) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        email: input.email,
        role: input.role,
        active: input.active,
        ...(input.password
          ? { passwordHash: await hashPassword(input.password) }
          : {}),
      },
    });
  } else {
    await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        role: input.role,
        active: input.active,
        passwordHash: await hashPassword(input.password!),
      },
    });
  }

  await recordAudit(
    session.userId,
    userId ? "update" : "create",
    "User",
    userId ?? undefined,
    input.email,
  );

  return formSuccess("Usuario guardado.");
}

export async function deleteUser(id: string) {
  const session = await requireAdmin();

  if (id === session.userId) {
    throw new Error("No puedes eliminar tu propia cuenta.");
  }

  // Nunca dejamos el panel sin ningún administrador activo.
  const remainingAdmins = await prisma.user.count({
    where: { role: "ADMIN", active: true, id: { not: id } },
  });

  if (remainingAdmins === 0) {
    throw new Error("Debe quedar al menos un administrador activo.");
  }

  await prisma.user.delete({ where: { id } });
  await recordAudit(session.userId, "delete", "User", id);
}
