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

/** Pedir el enlace para volver a entrar. */
export const requestResetSchema = z.object({
  email: emailSchema,
});

/** Elegir la contrasena nueva desde el enlace del correo. */
export const passwordResetSchema = z.object({
  token: trimmed.min(20).max(200),
  password: passwordSchema,
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
    // Quien entra. Por defecto lo hereda del dia; ver enum EventAccess.
    access: z.enum(["SEGUN_EL_DIA", "PUBLICO", "PRIVADO"]).default("SEGUN_EL_DIA"),
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
  station: z.enum(["BARRA", "COCINA"]).default("COCINA"),
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
  // Vacio = el producto sigue la impresora de su categoria.
  station: z.enum(["BARRA", "COCINA"]).optional().or(z.literal("")),
  promoPrice: trimmed.max(20).optional().or(z.literal("")),
  promoLabel: trimmed.max(40).optional().or(z.literal("")),
  promoStartsAt: trimmed.optional().or(z.literal("")),
  promoEndsAt: trimmed.optional().or(z.literal("")),
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

export const promotionSchema = z
  .object({
    title: trimmed.min(2, "El titulo es obligatorio").max(140),
    slug: trimmed.max(90).optional().or(z.literal("")),
    description: trimmed.min(2, "Describe el beneficio").max(600),
    terms: trimmed.max(1200).optional().or(z.literal("")),
    imageUrl: optionalUrl,
    type: z.enum(["PERCENT_OFF", "AMOUNT_OFF", "TWO_FOR_ONE", "FREE_ITEM"]),
    value: trimmed.optional().or(z.literal("")),
    scope: z.enum(["CUENTA", "CATEGORIA", "PRODUCTO"]).default("CUENTA"),
    productId: trimmed.max(40).optional().or(z.literal("")),
    categoryId: trimmed.max(40).optional().or(z.literal("")),
    startsAt: trimmed.min(1, "Indica desde cuando aplica"),
    endsAt: trimmed.optional().or(z.literal("")),
    active: z.coerce.boolean().default(true),
    maxPerCard: z.coerce.number().int().min(0).max(999).default(1),
    maxTotal: z.coerce.number().int().min(0).max(1_000_000).default(0),
    availableWeekdays: z.array(z.coerce.number().int().min(0).max(6)).default([]),
  })
  /*
   * Una promocion sin objetivo es una promocion que el POS no puede aplicar.
   *
   * Es la validacion que le faltaba al sistema anterior: se podia crear un
   * "2x1" que no decia de que, y la garzona quedaba con un boton que no sabia
   * que descontar. Se corta al guardar, no en la mesa.
   */
  .refine((data) => data.scope !== "PRODUCTO" || !!data.productId, {
    path: ["productId"],
    error: "Elige el producto sobre el que aplica",
  })
  .refine((data) => data.scope !== "CATEGORIA" || !!data.categoryId, {
    path: ["categoryId"],
    error: "Elige la categoria sobre la que aplica",
  })
  .refine(
    (data) =>
      data.type !== "FREE_ITEM" ||
      (data.scope === "PRODUCTO" && !!data.productId),
    {
      path: ["productId"],
      error: "Una cortesia tiene que decir que producto se regala",
    },
  )
  .refine((data) => data.type !== "TWO_FOR_ONE" || data.scope !== "CUENTA", {
    path: ["scope"],
    error: "Un 2x1 aplica sobre un producto o una categoria, no sobre la cuenta",
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
  heroImageMobileUrl: optionalUrl,
  heroVideoUrl: optionalUrl,
  heroCtaLabel: trimmed.max(40).optional().or(z.literal("")),
  heroCtaHref: trimmed.max(200).optional().or(z.literal("")),
  heroCtaSecondaryLabel: trimmed.max(40).optional().or(z.literal("")),
  heroCtaSecondaryHref: trimmed.max(200).optional().or(z.literal("")),
  heroVideoPosterUrl: optionalUrl,

  marqueeText: trimmed.max(600).optional().or(z.literal("")),

  homeEventsEyebrow: trimmed.max(60).optional().or(z.literal("")),
  homeEventsTitle: trimmed.max(120).optional().or(z.literal("")),
  homeEventsLead: trimmed.max(400).optional().or(z.literal("")),
  homeMenuEyebrow: trimmed.max(60).optional().or(z.literal("")),
  homeMenuTitle: trimmed.max(120).optional().or(z.literal("")),
  homeMenuLead: trimmed.max(400).optional().or(z.literal("")),
  homeLoyaltyTitle: trimmed.max(120).optional().or(z.literal("")),
  homeGalleryEyebrow: trimmed.max(60).optional().or(z.literal("")),
  homeGalleryTitle: trimmed.max(120).optional().or(z.literal("")),
  homeGalleryLead: trimmed.max(400).optional().or(z.literal("")),
  homeLocationEyebrow: trimmed.max(60).optional().or(z.literal("")),
  homeLocationTitle: trimmed.max(120).optional().or(z.literal("")),

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
  /* A quien le llega el aviso de un mensaje del formulario. Varias
     direcciones separadas por coma; el envio filtra lo que no sea una. */
  notifyEmails: trimmed.max(400).optional().or(z.literal("")),

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

  // El precio llega como texto del formulario ("5.500") y se guarda en centesimos.
  cardPrice: trimmed.max(20).optional().or(z.literal("")),
  cardPaymentInfo: trimmed.max(1200).optional().or(z.literal("")),
  cardPickupInfo: trimmed.max(1200).optional().or(z.literal("")),
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

// --- POS de sala -------------------------------------------------------------

export const posOpenTableSchema = z.object({
  tableId: trimmed.min(1, "Elige una mesa"),
  guests: z.coerce.number().int().min(1, "Al menos una persona").max(40).default(1),
  note: trimmed.max(200).optional().or(z.literal("")),
});

export const posDinerSchema = z.object({
  sessionId: trimmed.min(1),
  // Como se ve, no como se llama: "polera azul", "pelo largo".
  label: trimmed.min(2, "Describe al comensal").max(40),
  color: trimmed.max(20).optional().or(z.literal("")),
});

export const posItemSchema = z.object({
  sessionId: trimmed.min(1),
  productId: trimmed.min(1, "Elige un producto"),
  dinerId: trimmed.max(40).optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
  note: trimmed.max(140).optional().or(z.literal("")),
});

export const posPaymentSchema = z.object({
  sessionId: trimmed.min(1),
  /** Vacio = se cobra la mesa completa. */
  dinerId: trimmed.max(40).optional().or(z.literal("")),
  method: z.enum(["EFECTIVO", "DEBITO", "CREDITO", "TRANSFERENCIA", "OTRO"]),
});

/** Tarjeta presentada en la mesa: numero tipeado, QR escaneado o codigo. */
export const posCardSchema = z.object({
  sessionId: trimmed.min(1),
  input: trimmed.min(1, "Escanea o escribe la tarjeta").max(200),
});

/** Beneficio que la garzona aplica a una cuenta. */
export const posPromotionSchema = z.object({
  sessionId: trimmed.min(1),
  promotionId: trimmed.min(1),
  /** Vacio = a la cuenta compartida de la mesa. */
  dinerId: trimmed.max(40).optional().or(z.literal("")),
});

export const posTableSchema = z.object({
  id: trimmed.max(40).optional().or(z.literal("")),
  number: z.coerce.number().int().min(1, "Numero de mesa").max(999),
  name: trimmed.max(60).optional().or(z.literal("")),
  zone: trimmed.max(40).optional().or(z.literal("")),
  seats: z.coerce.number().int().min(1).max(40).default(4),
  active: z.coerce.boolean().default(true),
});

// --- Karaoke -----------------------------------------------------------------

/** Un video de YouTube: 11 caracteres de alfabeto propio. */
const youtubeVideoId = trimmed.regex(
  /^[A-Za-z0-9_-]{11}$/,
  "Identificador de video invalido",
);

/** Busqueda del encargado, la unica que gasta cuota de la API. */
export const karaokeSearchSchema = z.object({
  query: trimmed.min(2, "Escribe la canción que buscas").max(120),
});

/** Turno que carga sala directamente, ya con el video elegido. */
export const karaokeQueueSchema = z.object({
  videoId: youtubeVideoId,
  title: trimmed.min(1).max(200),
  channel: trimmed.max(120).optional().or(z.literal("")),
  durationSeconds: z.coerce.number().int().min(0).max(36000).optional(),
  thumbnailUrl: trimmed.max(400).optional().or(z.literal("")),
  singer: trimmed.min(2, "¿Quién canta?").max(60),
  /** Vacio = nadie anoto la mesa (pasa cuando la pide alguien de pie). */
  tableId: trimmed.max(40).optional().or(z.literal("")),
  note: trimmed.max(140).optional().or(z.literal("")),
});

/**
 * Pedido desde el QR de la mesa.
 *
 * Puede venir con una cancion del catalogo (`trackId`) o escrita a mano
 * (`requestText`), que es lo que pasa cuando el local todavia no tiene esa
 * cancion vista. La accion exige una de las dos.
 */
export const karaokeRequestSchema = z.object({
  singer: trimmed.min(2, "Escribe con qué nombre te llamamos").max(60),
  tableNumber: z.coerce
    .number()
    .int()
    .min(1, "Indica tu mesa")
    .max(999)
    .optional(),
  trackId: trimmed.max(40).optional().or(z.literal("")),
  requestText: trimmed.max(120).optional().or(z.literal("")),
  website: z.string().max(0, "Solicitud rechazada").optional().or(z.literal("")),
});

/** Un dia en que el local no abre (evento privado, vacaciones). */
export const closedDaySchema = z.object({
  date: trimmed.regex(/^\d{4}-\d{2}-\d{2}$/, "Indica el dia"),
  reason: trimmed.max(80).optional().or(z.literal("")),
  note: trimmed.max(300).optional().or(z.literal("")),
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
