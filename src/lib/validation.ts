import { z } from "zod";

/**
 * Esquemas compartidos por Server Actions y route handlers. La validacion vive
 * del lado del servidor: el formulario puede ayudar, pero nunca es la garantia.
 */

const trimmed = z.string().trim();

export const emailSchema = z.email("Email invalido").max(180).toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(120, "La contraseña es demasiado larga");

// --- Acceso ------------------------------------------------------------------

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Ingresa tu contraseña").max(120),
});

export const memberRegisterSchema = z.object({
  fullName: trimmed.min(2, "Ingresa tu nombre").max(120),
  email: emailSchema,
  password: passwordSchema,
  phone: trimmed.max(40).optional().or(z.literal("")),
  birthDate: trimmed.optional().or(z.literal("")),
  acceptsNews: z.coerce.boolean().default(true),
  acceptsTerms: z.literal("on", {
    error: "Debes aceptar los terminos del programa",
  }),
});

// --- Eventos -----------------------------------------------------------------

export const eventCategorySchema = z.enum([
  "TRIBUTO",
  "EN_VIVO",
  "DJ",
  "KARAOKE",
  "STANDUP",
  "FIESTA",
  "ESPECIAL",
]);

const optionalText = trimmed.max(8000).optional().or(z.literal(""));
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .or(z.literal(""))
  .refine(
    (value) => !value || /^(https?:\/\/|\/)/.test(value),
    "Debe ser una URL valida o una ruta que empiece con /",
  );

export const eventSchema = z
  .object({
    title: trimmed.min(2, "El titulo es obligatorio").max(160),
    slug: trimmed.max(90).optional().or(z.literal("")),
    artist: trimmed.max(160).optional().or(z.literal("")),
    category: eventCategorySchema,
    excerpt: trimmed.max(400).optional().or(z.literal("")),
    description: optionalText,
    posterUrl: optionalUrl,
    coverUrl: optionalUrl,
    startsAt: trimmed.min(1, "Indica la fecha y hora del evento"),
    doorsAt: trimmed.optional().or(z.literal("")),
    endsAt: trimmed.optional().or(z.literal("")),
    isFree: z.coerce.boolean().default(false),
    price: trimmed.optional().or(z.literal("")),
    ticketUrl: optionalUrl,
    capacity: trimmed.optional().or(z.literal("")),
    published: z.coerce.boolean().default(false),
    featured: z.coerce.boolean().default(false),
    ratingLock: z.coerce.boolean().default(false),
    seoTitle: trimmed.max(180).optional().or(z.literal("")),
    seoDescription: trimmed.max(400).optional().or(z.literal("")),
    ogImageUrl: optionalUrl,
  })
  .refine((data) => data.isFree || (data.price && Number(data.price) > 0), {
    error: "Indica el precio de la entrada o marca el evento como gratuito",
    path: ["price"],
  });

// --- Carta -------------------------------------------------------------------

export const menuCategorySchema = z.object({
  name: trimmed.min(2, "El nombre es obligatorio").max(80),
  slug: trimmed.max(90).optional().or(z.literal("")),
  description: trimmed.max(500).optional().or(z.literal("")),
  imageUrl: optionalUrl,
  icon: trimmed.max(40).optional().or(z.literal("")),
  active: z.coerce.boolean().default(true),
});

export const menuProductSchema = z.object({
  categoryId: trimmed.min(1, "Selecciona una categoria"),
  name: trimmed.min(2, "El nombre es obligatorio").max(120),
  slug: trimmed.max(90).optional().or(z.literal("")),
  description: trimmed.max(600).optional().or(z.literal("")),
  price: trimmed.min(1, "Indica el precio"),
  imageUrl: optionalUrl,
  available: z.coerce.boolean().default(true),
  featured: z.coerce.boolean().default(false),
  tags: trimmed.max(200).optional().or(z.literal("")),
});

// --- Galeria -----------------------------------------------------------------

export const galleryImageSchema = z.object({
  url: z.string().trim().min(1, "Sube o indica una imagen").max(500),
  alt: trimmed.min(2, "Describe la imagen (accesibilidad)").max(200),
  caption: trimmed.max(200).optional().or(z.literal("")),
  tag: trimmed.max(40).optional().or(z.literal("")),
  eventId: trimmed.max(40).optional().or(z.literal("")),
  featured: z.coerce.boolean().default(false),
  active: z.coerce.boolean().default(true),
});

// --- Promociones -------------------------------------------------------------

export const promotionSchema = z.object({
  title: trimmed.min(2, "El titulo es obligatorio").max(140),
  slug: trimmed.max(90).optional().or(z.literal("")),
  description: trimmed.min(2, "Describe el beneficio").max(600),
  terms: trimmed.max(1200).optional().or(z.literal("")),
  imageUrl: optionalUrl,
  type: z.enum(["PERCENT_OFF", "AMOUNT_OFF", "TWO_FOR_ONE", "FREE_ITEM", "OTHER"]),
  value: trimmed.optional().or(z.literal("")),
  startsAt: trimmed.min(1, "Indica desde cuando aplica"),
  endsAt: trimmed.optional().or(z.literal("")),
  active: z.coerce.boolean().default(true),
  minTier: z.enum(["CLASICA", "PLATA", "ORO"]).default("CLASICA"),
  maxPerCard: z.coerce.number().int().min(0).max(999).default(1),
  maxTotal: z.coerce.number().int().min(0).max(1_000_000).default(0),
  pointsCost: z.coerce.number().int().min(0).max(100_000).default(0),
  pointsReward: z.coerce.number().int().min(0).max(100_000).default(0),
  availableWeekdays: z.array(z.coerce.number().int().min(0).max(6)).default([]),
});

// --- Ajustes -----------------------------------------------------------------

export const settingsSchema = z.object({
  barName: trimmed.min(1).max(80),
  tagline: trimmed.max(160),
  logoUrl: optionalUrl,
  logoAltUrl: optionalUrl,
  faviconUrl: optionalUrl,

  heroTitle: trimmed.min(1).max(120),
  heroEyebrow: trimmed.max(60).optional().or(z.literal("")),
  heroSubtitle: trimmed.max(400).optional().or(z.literal("")),
  heroImageUrl: optionalUrl,
  heroVideoUrl: optionalUrl,
  heroCtaLabel: trimmed.max(40).optional().or(z.literal("")),
  heroCtaHref: trimmed.max(200).optional().or(z.literal("")),
  heroCtaSecondaryLabel: trimmed.max(40).optional().or(z.literal("")),
  heroCtaSecondaryHref: trimmed.max(200).optional().or(z.literal("")),

  aboutTitle: trimmed.max(120).optional().or(z.literal("")),
  aboutLead: trimmed.max(600).optional().or(z.literal("")),
  aboutBody: trimmed.max(6000).optional().or(z.literal("")),
  aboutImageUrl: optionalUrl,
  aboutSecondaryImageUrl: optionalUrl,

  address: trimmed.min(1).max(200),
  addressCity: trimmed.max(120),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  phone: trimmed.max(40).optional().or(z.literal("")),
  whatsapp: trimmed.max(40).optional().or(z.literal("")),
  email: trimmed.max(180).optional().or(z.literal("")),

  reservationsNote: trimmed.max(600).optional().or(z.literal("")),
  footerNote: trimmed.max(600).optional().or(z.literal("")),

  seoTitle: trimmed.min(1).max(180),
  seoDescription: trimmed.min(1).max(400),
  seoImageUrl: optionalUrl,
  seoKeywords: trimmed.max(400).optional().or(z.literal("")),
  googleAnalyticsId: trimmed.max(40).optional().or(z.literal("")),

  loyaltyEnabled: z.coerce.boolean().default(true),
  loyaltyTitle: trimmed.max(60),
  loyaltyDescription: trimmed.max(800).optional().or(z.literal("")),
  loyaltyTerms: trimmed.max(4000).optional().or(z.literal("")),
});

export const socialLinkSchema = z.object({
  platform: trimmed.min(1, "Selecciona la red").max(40),
  label: trimmed.min(1, "Indica el nombre visible").max(60),
  url: z
    .string()
    .trim()
    .min(1, "Indica el enlace")
    .max(300)
    .refine((v) => /^https?:\/\//.test(v), "El enlace debe empezar con https://"),
  active: z.coerce.boolean().default(true),
});

export const openingHourSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  opensAt: trimmed.max(5).optional().or(z.literal("")),
  closesAt: trimmed.max(5).optional().or(z.literal("")),
  closed: z.coerce.boolean().default(false),
  note: trimmed.max(80).optional().or(z.literal("")),
});

// --- Usuarios del panel ------------------------------------------------------

export const userSchema = z.object({
  name: trimmed.min(2, "Indica el nombre").max(120),
  email: emailSchema,
  password: z.string().max(120).optional().or(z.literal("")),
  role: z.enum(["ADMIN", "EDITOR", "STAFF"]),
  active: z.coerce.boolean().default(true),
});

// --- Publico -----------------------------------------------------------------

export const contactSchema = z.object({
  name: trimmed.min(2, "Ingresa tu nombre").max(120),
  email: emailSchema,
  phone: trimmed.max(40).optional().or(z.literal("")),
  subject: trimmed.max(140).optional().or(z.literal("")),
  message: trimmed.min(10, "Cuéntanos un poco mas").max(2000),
  // Campo trampa: los bots lo completan, las personas no lo ven.
  website: z.string().max(0, "Solicitud rechazada").optional().or(z.literal("")),
});

export const eventRatingSchema = z.object({
  eventId: trimmed.min(1),
  authorName: trimmed.min(2, "Ingresa tu nombre").max(80),
  rating: z.coerce
    .number()
    .int()
    .min(1, "Elige una puntuacion")
    .max(5, "La puntuacion maxima es 5"),
  comment: trimmed.max(600).optional().or(z.literal("")),
  website: z.string().max(0, "Solicitud rechazada").optional().or(z.literal("")),
});

// --- Utilidades --------------------------------------------------------------

/** Convierte "1.250,50" o "1250.5" a centesimos. */
export function parsePriceToCents(input: string): number {
  const normalized = input
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}\b)/g, "")
    .replace(",", ".");

  const value = Number(normalized);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Precio invalido");
  }

  return Math.round(value * 100);
}

/** Primer mensaje de error por campo, listo para pintar en el formulario. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!result[key]) result[key] = issue.message;
  }

  return result;
}
