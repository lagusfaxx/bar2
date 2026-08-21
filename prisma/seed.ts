/**
 * Contenido de demostración de BARZUO.
 *
 * El objetivo es que, apenas se levanta el proyecto, la web se vea terminada:
 * cartelera con tributos y shows, carta completa, galería, promociones de la
 * BarzuCard y los datos del local.
 *
 * Es idempotente (usa upsert por slug/clave), así que se puede volver a correr
 * sin duplicar contenido. Ejecutar con: npm run db:seed
 */
import "dotenv/config";

import { randomBytes, randomInt } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { aplicarCarta } from "./carta";
import { PrismaClient } from "../src/generated/prisma/client";
import type { EventCategory, PromotionType } from "../src/generated/prisma/enums";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const VENUE_TZ = process.env.NEXT_PUBLIC_TIME_ZONE ?? "America/Santiago";

// --- Utilidades de fecha -----------------------------------------------------

/** Diferencia entre la zona del local y UTC en un instante dado. */
function zoneOffsetMs(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: VENUE_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(instant)
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

  return asUtc - instant.getTime();
}

/**
 * Convierte una hora de pared del local en el instante UTC correspondiente.
 * Sin esto, un show cargado a las 22:30 se guardaria como 22:30 UTC y la web lo
 * mostraria a las 19:30 en Santiago.
 */
function venueTime(year: number, month: number, day: number, hour: number, minute = 0) {
  const guess = Date.UTC(year, month, day, hour, minute);
  return new Date(guess - zoneOffsetMs(new Date(guess)));
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function weekdayInVenue(date: Date) {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: VENUE_TZ,
    weekday: "short",
  }).format(date);
  return WEEKDAY_NAMES.indexOf(label);
}

/**
 * Proxima (o pasada) ocurrencia de un dia de la semana, a la hora indicada.
 * Se usa para que la cartelera de demostracion sea coherente: el karaoke de los
 * jueves cae realmente en jueves, y el show del sabado en sabado.
 */
function onWeekday(weekday: number, weeksOffset: number, hour: number, minute = 0) {
  const today = new Date();
  const currentWeekday = weekdayInVenue(today);

  // Dias hasta el proximo dia de la semana buscado (0 = hoy mismo cuenta como 7
  // para que los eventos "proximos" no queden en el pasado inmediato).
  let delta = (weekday - currentWeekday + 7) % 7;
  if (delta === 0) delta = 7;

  const target = new Date(today);
  target.setDate(target.getDate() + delta + weeksOffset * 7);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VENUE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(target);

  const [year, month, day] = parts.split("-").map(Number);
  return venueTime(year!, month! - 1, day!, hour, minute);
}

function daysFromNow(days: number, hour: number, minute = 0) {
  const target = new Date();
  target.setDate(target.getDate() + days);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VENUE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(target);

  const [year, month, day] = parts.split("-").map(Number);
  return venueTime(year!, month! - 1, day!, hour, minute);
}

// --- Utilidades de tarjeta ---------------------------------------------------

function luhn(digits: string) {
  let sum = 0;
  let double = true;
  for (let i = digits.length - 1; i >= 0; i--) {
    let value = digits.charCodeAt(i) - 48;
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return String((10 - (sum % 10)) % 10);
}

function cardNumber() {
  let body = "5210";
  for (let i = 0; i < 11; i++) body += randomInt(0, 10);
  return body + luhn(body);
}

// --- Datos -------------------------------------------------------------------

const SETTINGS = {
  barName: "BARZUO",
  tagline: "Bar · Lounge & Club",
  heroTitle: "BARZUO",
  heroEyebrow: "EST. 2024",
  heroSubtitle:
    "Música en vivo, tributos y cervezas bien frías en el corazón de Santiago. Abrimos cuando cae el sol y cerramos cuando se apaga la última canción.",
  heroCtaLabel: "Ver cartelera",
  heroCtaHref: "/eventos",
  heroCtaSecondaryLabel: "Ver la carta",
  heroCtaSecondaryHref: "/carta",
  heroImageUrl: "/demo/hero.jpg",

  marqueeText: [
    "Música en vivo",
    "Tributos",
    "DJ sets",
    "Cervezas de barril",
    "Cocina de bar",
    "Karaoke",
    "After office",
  ].join("\n"),

  homeEventsEyebrow: "Cartelera",
  homeEventsTitle: "Lo que se viene",
  homeEventsLead:
    "Tributos, bandas en vivo y noches de DJ. La programación se actualiza todas las semanas.",
  homeMenuEyebrow: "La carta",
  homeMenuTitle: "Para acompañar la noche",
  homeMenuLead:
    "Cervezas de barril, cocina de bar y mesas pensadas para compartir.",
  homeLoyaltyTitle: "Tu tarjeta de beneficios",
  homeGalleryEyebrow: "Galería",
  homeGalleryTitle: "Noches que quedan",
  homeGalleryLead: "Un vistazo a lo que se vive cada fin de semana en BARZUO.",
  homeLocationEyebrow: "Ubicación",
  homeLocationTitle: "Te esperamos",

  aboutTitle: "Un bar hecho de canciones",
  aboutLead:
    "BARZUO nació en 2024 con una idea simple: que en Santiago hubiera un lugar donde la música en vivo no fuera el fondo, sino el motivo.",
  aboutBody: `Empezamos con un escenario chico, dos parlantes prestados y una banda de amigos tocando covers un jueves de invierno. No entró casi nadie. La semana siguiente entraron veinte personas, y a la otra no quedaba mesa libre.

Hoy BARZUO es tres cosas a la vez: un restobar donde se come bien antes del show, un club donde suenan los tributos que la gente se sabe de memoria, y un lounge donde la noche puede terminar tranquila, con una buena cerveza y la conversación justa.

Nuestra cocina trabaja con producto local y nuestra barra apuesta a la cerveza bien servida: barril frío y etiquetas elegidas para acompañar una noche larga, no para lucirse en una foto. El resto lo pone la gente que viene, canta y se queda hasta que se prenden las luces.`,
  aboutImageUrl: "/demo/about-1.jpg",
  aboutSecondaryImageUrl: "/demo/about-2.jpg",

  address: "Av. Italia 1348",
  addressCity: "Providencia, Santiago",
  latitude: -33.43739,
  longitude: -70.62742,
  phone: "+56 2 2487 3714",
  whatsapp: "+56912345678",
  email: "hola@barzuo.com",

  reservationsNote:
    "Reservamos mesas hasta 30 minutos antes del show. Para grupos de más de 8 personas, escríbenos por WhatsApp.",
  footerNote:
    "Restobar, lounge y club en Santiago. Shows en vivo, tributos y cerveza de barril todas las semanas.",

  seoTitle: "BARZUO Restobar · Música en vivo, tributos y cerveza",
  seoDescription:
    "Cartelera de shows en vivo, tributos y DJ sets en Santiago. Cervezas de barril, cocina de bar y las mejores noches de la semana en BARZUO.",
  seoImageUrl: "/demo/og-default.jpg",
  seoKeywords:
    "bar santiago, música en vivo santiago, tributos, restobar, cervecería, shows en vivo, barzuo",

  loyaltyEnabled: true,
  loyaltyTitle: "BarzuCard",
  loyaltyDescription:
    "Regístrate y recibe tu BarzuCard con QR y número único. Preséntala en el local para canjear descuentos, 2x1 y cortesías, y suma puntos en cada visita.",
  loyaltyTerms: `La BarzuCard es personal e intransferible y se emite sin costo al registrarse en barzuo.com.

Cada promoción indica sus condiciones: vigencia, días habilitados y cantidad de usos por tarjeta. Los beneficios no son acumulables entre sí ni canjeables por dinero.

El canje se realiza en el local presentando el QR o el número de tarjeta al personal de BARZUO. BARZUO puede suspender una tarjeta ante un uso indebido.`,

  cardPriceCents: 550000,
  cardPaymentInfo: `Banco Ejemplo · Cuenta corriente 000-11-22222
Titular: BARZUO SpA · 76.543.210-9
Correo de aviso: pagos@barzuo.com

Escribe tu nombre y el número de operación al transferir.`,
  cardPickupInfo: `Retira tu tarjeta en el local de martes a sábado, desde las 19:00.
Preséntate en la barra con tu documento y el QR de esta página.`,
};

const SOCIAL = [
  { platform: "instagram", label: "@barzuo.cl", url: "https://instagram.com/barzuo.cl" },
  { platform: "facebook", label: "BARZUO Restobar", url: "https://facebook.com/barzuo" },
  { platform: "tiktok", label: "@barzuo", url: "https://tiktok.com/@barzuo" },
  { platform: "whatsapp", label: "Reservas por WhatsApp", url: "https://wa.me/56912345678" },
  { platform: "spotify", label: "Playlist BARZUO", url: "https://open.spotify.com" },
];

const HOURS = [
  { dayOfWeek: 0, closed: true, opensAt: null, closesAt: null, note: null },
  { dayOfWeek: 1, closed: true, opensAt: null, closesAt: null, note: null },
  { dayOfWeek: 2, closed: false, opensAt: "19:00", closesAt: "01:00", note: null },
  { dayOfWeek: 3, closed: false, opensAt: "19:00", closesAt: "02:00", note: "Karaoke" },
  { dayOfWeek: 4, closed: false, opensAt: "19:00", closesAt: "03:00", note: null },
  { dayOfWeek: 5, closed: false, opensAt: "19:00", closesAt: "05:00", note: "Show + DJ" },
  { dayOfWeek: 6, closed: false, opensAt: "20:00", closesAt: "05:00", note: "Show + DJ" },
];

type SeedEvent = {
  slug: string;
  title: string;
  artist: string | null;
  category: EventCategory;
  excerpt: string;
  description: string;
  poster: number;
  /** 0 = domingo … 6 = sábado, en la zona horaria del local. */
  weekday: number;
  /** 0 = la próxima ocurrencia; negativo para eventos ya realizados. */
  weeksOffset: number;
  hour: number;
  minute?: number;
  isFree: boolean;
  price?: number;
  featured?: boolean;
  capacity?: number;
};

const EVENTS: SeedEvent[] = [
  {
    slug: "tributo-soda-stereo-nada-personal",
    title: "Tributo a Soda Stereo",
    artist: "Nada Personal",
    category: "TRIBUTO",
    excerpt:
      "Un repaso completo por la discografía de Soda, de Signos a Canción Animal, con la banda que mejor lo hace en Santiago.",
    description: `Nada Personal lleva ocho años recorriendo el país con el tributo a Soda Stereo más fiel de Chile. Esta noche repasan los discos que marcaron a tres generaciones: Signos, Doble Vida y Canción Animal, completos y en orden.

El show arranca puntual a las 22:30. La cocina funciona desde las 19:00, así que conviene llegar temprano, cenar tranquilo y tomar lugar cerca del escenario.

Formación: guitarra y voz, bajo, batería y teclados. Sonido e iluminación de sala.`,
    poster: 1,
    weekday: 6,
    weeksOffset: 0,
    hour: 22,
    minute: 30,
    isFree: false,
    price: 1500000,
    featured: true,
    capacity: 180,
  },
  {
    slug: "jueves-de-karaoke",
    title: "Jueves de Karaoke",
    artist: null,
    category: "KARAOKE",
    excerpt:
      "Más de 20.000 canciones, pantalla grande y la barra abierta. Entrada libre toda la noche.",
    description: `El clásico de la semana. Catálogo de más de 20.000 canciones en español, inglés y portugués, pantalla de 3 metros y un host que se encarga de que nadie se quede sin cantar.

Entrada libre. Se arma lista por orden de llegada desde las 21:00.

Promoción de la noche: 2x1 en cervezas de barril de 21:00 a 23:00 presentando la BarzuCard.`,
    poster: 3,
    weekday: 4,
    weeksOffset: 0,
    hour: 21,
    isFree: true,
  },
  {
    slug: "dj-set-vinilos-de-los-90",
    title: "Vinilos de los 90",
    artist: "DJ Marce Sosa",
    category: "DJ",
    excerpt:
      "Solo vinilo, solo noventas. Britpop, grunge, house y todo lo que sonaba cuando la radio todavía importaba.",
    description: `Marce Sosa baja con dos bandejas, una caja de vinilos y ninguna concesión: todo lo que suena esta noche salió en los 90 y sale de un disco.

Britpop, grunge, trip hop, house de la primera camada y algún clásico latino bien elegido.

Arranca a las 23:30, después de la cena. Entrada liberada para quienes ya estén en el local.`,
    poster: 4,
    weekday: 5,
    weeksOffset: 0,
    hour: 23,
    minute: 30,
    isFree: true,
  },
  {
    slug: "noche-de-tributo-queen",
    title: "Tributo a Queen",
    artist: "Killer Queen CL",
    category: "TRIBUTO",
    excerpt:
      "Bohemian Rhapsody, Somebody to Love y todo el repertorio que la gente canta de memoria, con banda completa y coros en vivo.",
    description: `Killer Queen CL reconstruye el sonido de Queen sin pistas ni playback: cuatro músicos, coros a tres voces y un repertorio que no da respiro.

Hacen el set clásico de estadio — We Will Rock You, Radio Ga Ga, Under Pressure — y cierran, como corresponde, con Bohemian Rhapsody completa.

Entrada anticipada disponible hasta el día anterior al show.`,
    poster: 2,
    weekday: 6,
    weeksOffset: 1,
    hour: 23,
    isFree: false,
    price: 1800000,
    featured: true,
    capacity: 200,
  },
  {
    slug: "tributo-los-prisioneros",
    title: "Tributo a Los Prisioneros",
    artist: "La Voz de los 80",
    category: "TRIBUTO",
    excerpt:
      "De La voz de los 80 a Corazones. Un recorrido por la banda que le puso letra a toda una generación.",
    description: `La Voz de los 80 arma un recorrido cronológico por la obra de Los Prisioneros: los años de San Miguel, el salto de Pateando piedras y el giro pop de Corazones.

Formato banda completa: guitarra y voz, bajo, batería y teclados.

Cupos limitados — este show se agota siempre.`,
    poster: 5,
    weekday: 5,
    weeksOffset: 2,
    hour: 22,
    isFree: false,
    price: 1400000,
    featured: true,
    capacity: 150,
  },
  {
    slug: "stand-up-la-ultima-fecha",
    title: "Stand Up: La última fecha",
    artist: "Ciclo Humor Nocturno",
    category: "STANDUP",
    excerpt:
      "Cuatro comediantes, una hora y media de show y la cocina abierta durante toda la función.",
    description: `El ciclo Humor Nocturno cierra temporada con cuatro comediantes en escena y un formato de monólogos cortos, sin intervalos largos.

La cocina y la barra funcionan durante toda la función: se puede pedir sin perderse el show.

Recomendado para mayores de 16 años.`,
    poster: 6,
    weekday: 3,
    weeksOffset: 2,
    hour: 21,
    minute: 30,
    isFree: false,
    price: 1000000,
  },
  {
    slug: "fiesta-aniversario-barzuo",
    title: "Aniversario BARZUO",
    artist: "Banda invitada + DJ residente",
    category: "FIESTA",
    excerpt:
      "Cumplimos otro año. Show en vivo, DJ hasta el cierre y brindis de la casa para todos.",
    description: `La noche más importante del año en BARZUO. Arrancamos con show en vivo a las 23:00, seguimos con el DJ residente hasta el cierre y a la medianoche va el brindis de la casa para todo el local.

Sorteos durante la noche entre quienes presenten su BarzuCard.

Entrada libre hasta las 23:00; después, consumo mínimo.`,
    poster: 7,
    weekday: 6,
    weeksOffset: 3,
    hour: 23,
    isFree: true,
    featured: true,
    capacity: 250,
  },
  {
    slug: "noche-de-blues-y-barril",
    title: "Noche de Blues & Barril",
    artist: "Delta Sur",
    category: "EN_VIVO",
    excerpt:
      "Blues eléctrico en formato trío y una selección de cervezas de barril para acompañar.",
    description: `Delta Sur toca blues eléctrico de Chicago con la crudeza que corresponde: guitarra, bajo y batería, sin arreglos de más.

Durante el show, la barra ofrece una selección de cervezas de barril con precio especial.

Show en dos sets de 45 minutos.`,
    poster: 8,
    weekday: 4,
    weeksOffset: 4,
    hour: 22,
    isFree: false,
    price: 1200000,
  },
  {
    slug: "tributo-los-tres",
    title: "Tributo a Los Tres",
    artist: "Déjate Caer",
    category: "TRIBUTO",
    excerpt:
      "El ritual noventero en Santiago: banda completa, coros del público y clásicos de punta a punta.",
    description: `Déjate Caer trae el repertorio completo de Los Tres, con banda de siete músicos y sección de vientos para los arreglos de La Yein Fonda.

Pájaros de fuego, He barrido el sol, Déjate caer y lo que corresponde.

Este show suele agotar entradas: conviene comprar anticipada.`,
    poster: 9,
    weekday: 6,
    weeksOffset: -2,
    hour: 22,
    isFree: false,
    price: 1500000,
  },
  {
    slug: "after-office-barzuo",
    title: "After Office BARZUO",
    artist: "DJ residente",
    category: "FIESTA",
    excerpt:
      "Salida del trabajo directo al bar: tapas, cervezas a precio de happy hour y música hasta la medianoche.",
    description: `Todos los viernes de 18:00 a 21:00, el after office de BARZUO: tabla de tapas para compartir, cervezas de barril y schop a precio de happy hour, y el DJ residente en formato lounge.

Sin entrada. Se recomienda reservar mesa si vienen en grupo.`,
    poster: 10,
    weekday: 5,
    weeksOffset: -3,
    hour: 18,
    isFree: true,
  },
];

const GALLERY = [
  { file: 1, alt: "Público durante un show en vivo en BARZUO", caption: "Sábado de tributo", tag: "shows", featured: true },
  { file: 2, alt: "Barra de BARZUO iluminada de noche", caption: "La barra", tag: "ambiente", featured: true },
  { file: 3, alt: "Banda tocando sobre el escenario principal", caption: "Escenario principal", tag: "shows", featured: true },
  { file: 4, alt: "Schop de cerveza recién servido en la barra", caption: "Cerveza de barril", tag: "barra", featured: true },
  { file: 5, alt: "Vista general del salón con mesas ocupadas", caption: "Salón principal", tag: "ambiente", featured: true },
  { file: 6, alt: "Guitarrista durante un solo", caption: "Noche de blues", tag: "shows", featured: true },
  { file: 7, alt: "Tabla de fiambres y quesos para compartir", caption: "Para compartir", tag: "cocina" },
  { file: 8, alt: "Público cantando durante el karaoke", caption: "Jueves de karaoke", tag: "público" },
  { file: 9, alt: "DJ en cabina durante la madrugada", caption: "DJ set", tag: "shows" },
  { file: 10, alt: "Detalle de la iluminación del escenario", caption: "Luces de sala", tag: "ambiente" },
  { file: 11, alt: "Grupo de amigos brindando en una mesa", caption: "Brindis", tag: "público" },
  { file: 12, alt: "Hamburguesa de la casa servida en tabla", caption: "Cocina de bar", tag: "cocina" },
  { file: 13, alt: "Fachada de BARZUO de noche", caption: "La entrada", tag: "ambiente" },
  { file: 14, alt: "Público con las manos en alto durante el cierre", caption: "El cierre", tag: "público" },
];

/**
 * Promociones de ejemplo.
 *
 * Cada una dice sobre que aplica —`productSlug` o `categorySlug`—, que es lo
 * que le permite al POS descontarla solo en la cuenta de la mesa. Una promo sin
 * alcance definido aplica sobre el total de lo consumido.
 */
const PROMOTIONS: Array<{
  slug: string;
  title: string;
  description: string;
  terms: string;
  type: PromotionType;
  value: number;
  image: number;
  maxPerCard: number;
  /** Slug del producto de la carta sobre el que aplica. */
  productSlug?: string;
  /** Slug de la categoria de la carta sobre la que aplica. */
  categorySlug?: string;
  weekdays?: number[];
  maxTotal?: number;
}> = [
  {
    slug: "2x1-en-cervezas",
    title: "2x1 en Schop Heineken",
    description: "Pide dos schops Heineken y paga uno, de 21:00 a 23:00.",
    terms:
      "Válido de martes a jueves, de 21:00 a 23:00. Un uso por tarjeta por noche. No acumulable con otras promociones.",
    type: "TWO_FOR_ONE",
    value: 0,
    image: 1,
    maxPerCard: 0,
    productSlug: "cervezas-schop-heineken",
    weekdays: [2, 3, 4],
  },
  {
    slug: "20-off-en-cervezas",
    title: "20% off en cervezas",
    description: "Descuento sobre toda la carta de cervezas, de barril y botella.",
    terms:
      "Válido todos los días. Un uso por tarjeta. No aplica sobre productos que ya estén en promoción.",
    type: "PERCENT_OFF",
    value: 20,
    image: 2,
    maxPerCard: 1,
    categorySlug: "cervezas",
  },
  {
    slug: "tabla-barzuo-bonificada",
    title: "Tabla de charcutería de cortesía",
    description: "La tabla para compartir va por cuenta de la casa.",
    terms:
      "Un uso por tarjeta. Sujeto a disponibilidad de cocina. La garzona la carga en la cuenta al aplicar el beneficio.",
    type: "FREE_ITEM",
    value: 0,
    image: 3,
    maxPerCard: 1,
    productSlug: "charcuteria-y-frituras-tabla-de-charcuteria",
  },
  {
    slug: "3000-off-en-la-cuenta",
    title: "$3.000 off en tu cuenta",
    description: "Descuento fijo sobre el total de lo que consumas esta noche.",
    terms:
      "Un uso por tarjeta por visita. Si la cuenta suma menos de $3.000, el descuento se ajusta a ese total.",
    type: "AMOUNT_OFF",
    value: 300000,
    image: 4,
    maxPerCard: 0,
  },
  {
    slug: "cumpleanos-barzuo",
    title: "Brindis de cumpleaños",
    description: "Un espumante de la casa para tu mesa en la semana de tu cumpleaños.",
    terms:
      "Válido durante los siete días posteriores a la fecha de cumpleaños registrada. Un uso por año.",
    type: "FREE_ITEM",
    value: 0,
    image: 5,
    maxPerCard: 1,
    productSlug: "vinos-undurraga-brut",
  },
  {
    slug: "papas-de-la-casa",
    title: "Papas fritas de cortesía",
    description: "Una porción de papas fritas para picar mientras llega el show.",
    terms: "Un uso por tarjeta al mes. Sujeto a stock.",
    type: "FREE_ITEM",
    value: 0,
    image: 6,
    maxPerCard: 1,
    productSlug: "charcuteria-y-frituras-porcion-de-papas-fritas",
    maxTotal: 100,
  },
];

// --- Seed --------------------------------------------------------------------

/**
 * Crea o repara las cuentas del panel.
 *
 * Es lo unico que se puede correr sobre una base con contenido real sin pisar
 * nada: recupera el acceso si alguien se quedo fuera, sin tocar la contraseña.
 */
async function seedPanelUsers() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@barzuo.com").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Barzuo2024!";

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: process.env.ADMIN_NAME ?? "Administrador BARZUO",
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: "ADMIN",
    },
    // No pisamos la contraseña si el usuario ya existe: puede haberla cambiado.
    update: { role: "ADMIN", active: true },
  });

  const staffEmail = (process.env.STAFF_EMAIL ?? "sala@barzuo.com").toLowerCase();
  await prisma.user.upsert({
    where: { email: staffEmail },
    create: {
      email: staffEmail,
      name: "Equipo de sala BARZUO",
      passwordHash: await bcrypt.hash(
        process.env.STAFF_PASSWORD ?? "Barzuo2024!",
        12,
      ),
      role: "STAFF",
    },
    update: { role: "STAFF", active: true },
  });
  console.log(`· Usuarios del panel (${adminEmail} / ${staffEmail})`);
}

async function main() {
  const yaSembrada = await prisma.siteSettings.findUnique({
    where: { id: "singleton" },
    select: { id: true },
  });

  // El seed carga contenido de DEMOSTRACION. Sobre una base que ya tiene
  // contenido real pisaria la portada, la galeria y la cartelera cargadas
  // desde el panel: las imagenes subidas siguen en el volumen, pero los
  // ajustes vuelven a apuntar a /demo/*. Como el entrypoint puede correrlo en
  // cada arranque (SEED_ON_START), la unica proteccion segura es no sembrar
  // dos veces.
  if (yaSembrada && process.env.SEED_FORCE !== "true") {
    console.log(
      "La base ya tiene contenido: no se siembra nada.\n" +
        "Sembrar de nuevo devolveria la portada al contenido de demostracion.\n" +
        "Si de verdad quieres recargar la demo, corre el seed con SEED_FORCE=true.\n",
    );
    await seedPanelUsers();
    return;
  }

  console.log("Sembrando contenido de BARZUO…\n");

  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    // Los ajustes son contenido del local, no catalogo: una vez creados no se
    // pisan nunca. Aqui viven la portada, el logo y las imagenes del "nosotros".
    create: { id: "singleton", ...SETTINGS },
    update: {},
  });
  console.log("· Ajustes del sitio");

  await seedPanelUsers();

  for (const [index, link] of SOCIAL.entries()) {
    const existing = await prisma.socialLink.findFirst({
      where: { platform: link.platform },
    });

    if (existing) {
      await prisma.socialLink.update({
        where: { id: existing.id },
        data: { ...link, position: index },
      });
    } else {
      await prisma.socialLink.create({ data: { ...link, position: index } });
    }
  }
  console.log("· Redes sociales");

  for (const hour of HOURS) {
    await prisma.openingHour.upsert({
      where: { dayOfWeek: hour.dayOfWeek },
      create: hour,
      update: hour,
    });
  }
  console.log("· Horarios de atención");

  for (const event of EVENTS) {
    const startsAt = onWeekday(
      event.weekday,
      event.weeksOffset,
      event.hour,
      event.minute ?? 0,
    );

    const data = {
      title: event.title,
      artist: event.artist,
      category: event.category,
      excerpt: event.excerpt,
      description: event.description,
      posterUrl: `/demo/poster-${event.poster}.jpg`,
      startsAt,
      doorsAt: new Date(startsAt.getTime() - 60 * 60 * 1000),
      isFree: event.isFree,
      priceCents: event.isFree ? null : (event.price ?? null),
      capacity: event.capacity ?? null,
      published: true,
      featured: event.featured ?? false,
      seoTitle: `${event.title}${event.artist ? ` — ${event.artist}` : ""} en BARZUO`,
      seoDescription: event.excerpt,
      ogImageUrl: `/demo/poster-${event.poster}.jpg`,
    };

    await prisma.event.upsert({
      where: { slug: event.slug },
      create: { slug: event.slug, ...data },
      update: data,
    });
  }
  console.log(`· ${EVENTS.length} eventos de cartelera`);

  const carta = await aplicarCarta(prisma);
  console.log(
    `· Carta: ${carta.categorias} categorías, ${carta.productos} productos`,
  );
  if (carta.retirados.categorias > 0 || carta.retirados.productos > 0) {
    console.log(
      `· Carta anterior retirada: ${carta.retirados.categorias} categorías y ${carta.retirados.productos} productos`,
    );
  }

  // Mesas del salon: sin ellas los garzones no tienen donde abrir una cuenta.
  // Se ajustan despues desde el panel, en Sala → Mesas.
  const mesas = [
    ...Array.from({ length: 10 }, (_, index) => ({
      number: index + 1,
      zone: "Salón",
      seats: 4,
    })),
    ...Array.from({ length: 4 }, (_, index) => ({
      number: index + 11,
      zone: "Terraza",
      seats: 6,
    })),
  ];

  for (const [index, mesa] of mesas.entries()) {
    await prisma.posTable.upsert({
      where: { number: mesa.number },
      create: { ...mesa, position: index },
      update: {},
    });
  }
  console.log(`· ${mesas.length} mesas`);

  // Galería — vinculamos algunas fotos a eventos existentes.
  const eventsForGallery = await prisma.event.findMany({
    where: { slug: { in: EVENTS.slice(0, 4).map((e) => e.slug) } },
    select: { id: true },
  });

  for (const [index, image] of GALLERY.entries()) {
    const url = `/demo/gallery-${image.file}.jpg`;
    const existing = await prisma.galleryImage.findFirst({ where: { url } });

    const data = {
      url,
      alt: image.alt,
      caption: image.caption,
      tag: image.tag,
      position: index,
      featured: image.featured ?? false,
      eventId: index % 4 === 0 ? (eventsForGallery[index / 4]?.id ?? null) : null,
      active: true,
    };

    if (existing) {
      await prisma.galleryImage.update({ where: { id: existing.id }, data });
    } else {
      await prisma.galleryImage.create({ data });
    }
  }
  console.log(`· ${GALLERY.length} imágenes de galería`);

  for (const [index, promo] of PROMOTIONS.entries()) {
    /*
     * El alcance se resuelve contra la carta recien sembrada.
     *
     * Si el producto no existe —porque el local cambio su carta— la promocion
     * se siembra igual pero apuntando a la cuenta completa: es preferible una
     * promo mas generosa que una que el POS no pueda aplicar nunca.
     */
    const product = promo.productSlug
      ? await prisma.menuProduct.findUnique({
          where: { slug: promo.productSlug },
          select: { id: true },
        })
      : null;

    const category = promo.categorySlug
      ? await prisma.menuCategory.findUnique({
          where: { slug: promo.categorySlug },
          select: { id: true },
        })
      : null;

    const scope = product ? "PRODUCTO" : category ? "CATEGORIA" : "CUENTA";

    const data = {
      title: promo.title,
      description: promo.description,
      terms: promo.terms,
      type: promo.type,
      value: promo.value,
      imageUrl: `/demo/promo-${promo.image}.jpg`,
      startsAt: daysFromNow(-30, 0),
      endsAt: daysFromNow(180, 23, 59),
      active: true,
      position: index,
      scope,
      productId: product?.id ?? null,
      categoryId: category?.id ?? null,
      maxPerCard: promo.maxPerCard,
      maxTotal: promo.maxTotal ?? 0,
      availableWeekdays: promo.weekdays ?? [],
    } as const;

    await prisma.promotion.upsert({
      where: { slug: promo.slug },
      create: { slug: promo.slug, ...data },
      update: data,
    });
  }
  console.log(`· ${PROMOTIONS.length} promociones de BarzuCard`);

  // Socios de ejemplo, para probar la app del personal de sala de inmediato.
  const demoMembers = [
    { email: "sofia@ejemplo.com", fullName: "Sofía Ramírez" },
    { email: "martin@ejemplo.com", fullName: "Martín Cabrera" },
  ];

  for (const member of demoMembers) {
    const saved = await prisma.member.upsert({
      where: { email: member.email },
      create: {
        email: member.email,
        fullName: member.fullName,
        passwordHash: await bcrypt.hash("Barzuo2024!", 12),
        acceptsNews: true,
      },
      update: { fullName: member.fullName },
    });

    const existingCard = await prisma.barzuCard.findUnique({
      where: { memberId: saved.id },
    });

    if (!existingCard) {
      await prisma.barzuCard.create({
        data: {
          memberId: saved.id,
          cardNumber: cardNumber(),
          qrToken: randomBytes(24).toString("base64url"),
        },
      });
    }
  }
  console.log(`· ${demoMembers.length} socios de ejemplo con BarzuCard`);

  const pastEvent = await prisma.event.findUnique({
    where: { slug: "tributo-los-redondos" },
    select: { id: true },
  });

  if (pastEvent) {
    const reviews = [
      { authorName: "Lucía", rating: 5, comment: "Impecable el sonido y la banda. Volvemos seguro." },
      { authorName: "Diego", rating: 5, comment: "Se llenó y aun así se veía bien desde atrás." },
      { authorName: "Carolina", rating: 4, comment: "Muy buen show. La cocina cierra un poco temprano." },
    ];

    for (const [index, review] of reviews.entries()) {
      await prisma.eventRating.upsert({
        where: {
          eventId_fingerprint: {
            eventId: pastEvent.id,
            fingerprint: `seed-${index}`,
          },
        },
        create: {
          eventId: pastEvent.id,
          fingerprint: `seed-${index}`,
          approved: true,
          ...review,
        },
        update: { approved: true, ...review },
      });
    }
    console.log("· Reseñas de ejemplo");
  }

  console.log("\nListo. La web ya tiene contenido para mostrar.");
}

main()
  .catch((error) => {
    console.error("\nError al sembrar la base:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
