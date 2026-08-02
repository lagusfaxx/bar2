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

import { PrismaClient } from "../src/generated/prisma/client";
import type { EventCategory, PromotionType } from "../src/generated/prisma/enums";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const VENUE_TZ = process.env.NEXT_PUBLIC_TIME_ZONE ?? "America/Montevideo";

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
 * mostraria a las 19:30 en Montevideo.
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

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// --- Datos -------------------------------------------------------------------

const SETTINGS = {
  barName: "BARZUO",
  tagline: "Bar · Lounge & Club",
  heroTitle: "BARZUO",
  heroEyebrow: "EST. 2024",
  heroSubtitle:
    "Música en vivo, tributos y coctelería de autor en el corazón de Montevideo. Abrimos cuando cae el sol y cerramos cuando se apaga la última canción.",
  heroCtaLabel: "Ver cartelera",
  heroCtaHref: "/eventos",
  heroCtaSecondaryLabel: "Ver la carta",
  heroCtaSecondaryHref: "/carta",
  heroImageUrl: "/demo/hero.jpg",

  aboutTitle: "Un bar hecho de canciones",
  aboutLead:
    "BARZUO nació en 2024 con una idea simple: que en Montevideo hubiera un lugar donde la música en vivo no fuera el fondo, sino el motivo.",
  aboutBody: `Empezamos con un escenario chico, dos parlantes prestados y una banda de amigos tocando covers un jueves de invierno. No entró casi nadie. La semana siguiente entraron veinte personas, y a la otra no quedaba mesa libre.

Hoy BARZUO es tres cosas a la vez: un restobar donde se come bien antes del show, un club donde suenan los tributos que la gente se sabe de memoria, y un lounge donde la noche puede terminar tranquila, con un buen destilado y la conversación justa.

Nuestra cocina trabaja con producto local y nuestra barra apuesta a la coctelería de autor: tragos pensados para acompañar una noche larga, no para lucirse en una foto. El resto lo pone la gente que viene, canta y se queda hasta que se prenden las luces.`,
  aboutImageUrl: "/demo/about-1.jpg",
  aboutSecondaryImageUrl: "/demo/about-2.jpg",

  address: "Av. Presidente José Batlle y Ordóñez 3714",
  addressCity: "Montevideo, Uruguay",
  latitude: -34.86086,
  longitude: -56.16884,
  phone: "+598 2487 3714",
  whatsapp: "+59899123456",
  email: "hola@barzuo.com",

  reservationsNote:
    "Reservamos mesas hasta 30 minutos antes del show. Para grupos de más de 8 personas, escribinos por WhatsApp.",
  footerNote:
    "Restobar, lounge y club en Montevideo. Shows en vivo, tributos y coctelería de autor todas las semanas.",

  seoTitle: "BARZUO Restobar · Música en vivo, tributos y coctelería",
  seoDescription:
    "Cartelera de shows en vivo, tributos y DJ sets en Montevideo. Coctelería de autor, cocina de bar y las mejores noches de la semana en BARZUO.",
  seoImageUrl: "/demo/og-default.jpg",
  seoKeywords:
    "bar montevideo, música en vivo montevideo, tributos, restobar, coctelería, shows en vivo, barzuo",

  loyaltyEnabled: true,
  loyaltyTitle: "BarzuCard",
  loyaltyDescription:
    "Registrate y recibí tu BarzuCard con QR y número único. Presentala en el local para canjear descuentos, 2x1 y cortesías, y sumá puntos en cada visita.",
  loyaltyTerms: `La BarzuCard es personal e intransferible y se emite sin costo al registrarse en barzuo.com.

Cada promoción indica sus condiciones: vigencia, días habilitados y cantidad de usos por tarjeta. Los beneficios no son acumulables entre sí ni canjeables por dinero.

El canje se realiza en el local presentando el QR o el número de tarjeta al personal de BARZUO. BARZUO puede suspender una tarjeta ante un uso indebido.`,
};

const SOCIAL = [
  { platform: "instagram", label: "@barzuo.uy", url: "https://instagram.com/barzuo.uy" },
  { platform: "facebook", label: "BARZUO Restobar", url: "https://facebook.com/barzuo" },
  { platform: "tiktok", label: "@barzuo", url: "https://tiktok.com/@barzuo" },
  { platform: "whatsapp", label: "Reservas por WhatsApp", url: "https://wa.me/59899123456" },
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
      "Un repaso completo por la discografía de Soda, de Signos a Canción Animal, con la banda que mejor lo hace en Montevideo.",
    description: `Nada Personal lleva ocho años recorriendo el país con el tributo a Soda Stereo más fiel del Río de la Plata. Esta noche repasan los discos que marcaron a tres generaciones: Signos, Doble Vida y Canción Animal, completos y en orden.

El show arranca puntual a las 22:30. La cocina funciona desde las 19:00, así que conviene venir temprano, cenar tranquilo y agarrar lugar cerca del escenario.

Formación: guitarra y voz, bajo, batería y teclados. Sonido e iluminación de sala.`,
    poster: 1,
    weekday: 6,
    weeksOffset: 0,
    hour: 22,
    minute: 30,
    isFree: false,
    price: 65000,
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

Promo de la noche: 2x1 en chopps de 21:00 a 23:00 presentando la BarzuCard.`,
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

Arranca a las 23:30, después de la cena. Entrada libre para quienes ya estén en el local.`,
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
    artist: "Killer Queen UY",
    category: "TRIBUTO",
    excerpt:
      "Bohemian Rhapsody, Somebody to Love y todo el repertorio que la gente canta de memoria, con banda completa y coros en vivo.",
    description: `Killer Queen UY reconstruye el sonido de Queen sin pistas ni playback: cuatro músicos, coros a tres voces y un repertorio que no da respiro.

Hacen el set clásico de estadio — We Will Rock You, Radio Ga Ga, Under Pressure — y cierran, como corresponde, con Bohemian Rhapsody completa.

Entrada anticipada disponible hasta el día anterior al show.`,
    poster: 2,
    weekday: 6,
    weeksOffset: 1,
    hour: 23,
    isFree: false,
    price: 70000,
    featured: true,
    capacity: 200,
  },
  {
    slug: "tributo-charly-garcia",
    title: "Tributo a Charly García",
    artist: "Say No More Trío",
    category: "TRIBUTO",
    excerpt:
      "De Sui Generis a Clics Modernos. Un recorrido por cincuenta años de la mejor canción argentina.",
    description: `Say No More Trío arma un recorrido cronológico por la obra de Charly: los años de Sui Generis, el salto con Serú Girán y la etapa solista que arranca con Yendo de la cama al living.

Formato acústico ampliado: piano, bajo, batería y voz.

Cupos limitados — este show se agota siempre.`,
    poster: 5,
    weekday: 5,
    weeksOffset: 2,
    hour: 22,
    isFree: false,
    price: 60000,
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
    price: 45000,
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
    slug: "noche-de-blues-y-whisky",
    title: "Noche de Blues & Whisky",
    artist: "Delta Sur",
    category: "EN_VIVO",
    excerpt:
      "Blues eléctrico en formato trío y una selección de whiskys por copa para acompañar.",
    description: `Delta Sur toca blues eléctrico de Chicago con la crudeza que corresponde: guitarra, bajo y batería, sin arreglos de más.

Durante el show, la barra ofrece una selección de whiskys por copa con precio especial.

Show en dos sets de 45 minutos.`,
    poster: 8,
    weekday: 4,
    weeksOffset: 4,
    hour: 22,
    isFree: false,
    price: 50000,
  },
  {
    slug: "tributo-los-redondos",
    title: "Tributo a Patricio Rey",
    artist: "Ricota Sur",
    category: "TRIBUTO",
    excerpt:
      "El ritual ricotero en Montevideo: banda completa, coros del público y clásicos de punta a punta.",
    description: `Ricota Sur trae el repertorio completo de Patricio Rey y sus Redonditos de Ricota, con banda de siete músicos y sección de vientos.

Todo un palo, Un poco de amor francés, Jijiji y lo que corresponde.

Este show suele agotar entradas: conviene comprar anticipada.`,
    poster: 9,
    weekday: 6,
    weeksOffset: -2,
    hour: 22,
    isFree: false,
    price: 65000,
  },
  {
    slug: "after-office-barzuo",
    title: "After Office BARZUO",
    artist: "DJ residente",
    category: "FIESTA",
    excerpt:
      "Salida del trabajo directo al bar: tapas, chopps a precio de happy hour y música hasta la medianoche.",
    description: `Todos los viernes de 18:00 a 21:00, el after office de BARZUO: tabla de tapas para compartir, chopps y tragos clásicos a precio de happy hour, y el DJ residente en formato lounge.

Sin entrada. Se recomienda reservar mesa si vienen en grupo.`,
    poster: 10,
    weekday: 5,
    weeksOffset: -3,
    hour: 18,
    isFree: true,
  },
];

type SeedCategory = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  image: number;
  products: Array<{
    name: string;
    description: string;
    price: number;
    featured?: boolean;
    image?: number;
    tags?: string[];
  }>;
};

const MENU: SeedCategory[] = [
  {
    slug: "cocteleria-de-autor",
    name: "Coctelería de autor",
    description: "Tragos creados por nuestra barra, pensados para una noche larga.",
    icon: "Martini",
    image: 1,
    products: [
      {
        name: "Zuo Negroni",
        description: "Gin de la casa, vermouth rosso, bitter y un twist de naranja quemada.",
        price: 49000,
        featured: true,
        image: 1,
      },
      {
        name: "Humo y Miel",
        description: "Mezcal, miel de eucalipto, lima y un velo de humo de roble.",
        price: 52000,
        featured: true,
        image: 2,
        tags: ["ahumado"],
      },
      {
        name: "Batlle 3714",
        description: "Whisky, licor de café, naranja y espuma de cacao. El trago de la casa.",
        price: 55000,
        featured: true,
        image: 3,
      },
      {
        name: "Jardín de Invierno",
        description: "Gin, pepino, albahaca fresca y tónica artesanal.",
        price: 46000,
        image: 4,
        tags: ["refrescante"],
      },
      {
        name: "Clavel Rojo",
        description: "Vodka, frutos rojos, hibisco y lima.",
        price: 46000,
        image: 5,
      },
      {
        name: "Última Canción",
        description: "Maracuyá, jengibre, lima y soda. Sin alcohol, con la misma vuelta.",
        price: 32000,
        tags: ["sin alcohol"],
      },
    ],
  },
  {
    slug: "cervezas",
    name: "Cervezas",
    description: "Tiradas y en botella, con rotación semanal de artesanales.",
    icon: "Beer",
    image: 2,
    products: [
      { name: "Chopp Rubia 500cc", description: "Lager clásica, tirada del día.", price: 26000, image: 6 },
      { name: "Chopp IPA 500cc", description: "Amarga, cítrica y bien lupulada.", price: 30000, featured: true, image: 7 },
      { name: "Chopp Negra 500cc", description: "Stout suave, con notas de café y chocolate.", price: 30000 },
      { name: "Artesanal de la semana", description: "Preguntale al barman qué hay tirado hoy.", price: 32000 },
      { name: "Cerveza en botella 340cc", description: "Nacional, bien fría.", price: 21000 },
      { name: "Cerveza sin alcohol", description: "Botella 340cc.", price: 19000, tags: ["sin alcohol"] },
    ],
  },
  {
    slug: "destilados",
    name: "Destilados",
    description: "Whiskys, gins, rones y mezcales por copa.",
    icon: "GlassWater",
    image: 3,
    products: [
      { name: "Whisky single malt 12 años", description: "Por copa de 50cc.", price: 62000, image: 8 },
      { name: "Whisky blended", description: "Por copa de 50cc.", price: 38000 },
      { name: "Gin premium", description: "Con tónica y garnish a elección.", price: 45000 },
      { name: "Ron añejo", description: "Por copa de 50cc.", price: 42000 },
      { name: "Mezcal artesanal", description: "Con naranja y sal de gusano.", price: 58000, tags: ["ahumado"] },
      { name: "Grappamiel", description: "La de siempre, para cerrar la noche.", price: 24000 },
    ],
  },
  {
    slug: "tablas",
    name: "Tablas para compartir",
    description: "Para la previa del show, entre varios.",
    icon: "Utensils",
    image: 4,
    products: [
      {
        name: "Tabla BARZUO",
        description: "Fiambres, quesos, aceitunas, frutos secos y pan de masa madre. Para 3 o 4.",
        price: 118000,
        featured: true,
        image: 9,
      },
      { name: "Tabla de quesos", description: "Cinco quesos, dulce de leche y nueces. Para 2 o 3.", price: 92000, image: 10 },
      { name: "Tabla vegetariana", description: "Hummus, babaganoush, vegetales asados y pan pita.", price: 84000, tags: ["vegetariano"] },
      { name: "Picada criolla", description: "Chorizo, morcilla, provolone y papas rústicas.", price: 105000 },
    ],
  },
  {
    slug: "cocina",
    name: "Cocina",
    description: "Platos de bar bien resueltos, hasta el cierre de cocina.",
    icon: "ChefHat",
    image: 5,
    products: [
      { name: "Hamburguesa BARZUO", description: "Doble medallón, cheddar, panceta y salsa de la casa. Con papas.", price: 78000, featured: true, image: 11 },
      { name: "Milanesa napolitana", description: "Con papas fritas y ensalada. Porción generosa.", price: 72000, image: 12 },
      { name: "Bondiola braseada", description: "Ocho horas de cocción, puré rústico y cebolla caramelizada.", price: 85000 },
      { name: "Rabas", description: "Calamar rebozado, alioli de limón.", price: 68000 },
      { name: "Bowl vegetariano", description: "Quinoa, vegetales asados, palta y semillas.", price: 62000, tags: ["vegetariano", "sin gluten"] },
      { name: "Papas BARZUO", description: "Con cheddar, panceta y verdeo.", price: 48000, image: 13 },
    ],
  },
  {
    slug: "vinos",
    name: "Vinos",
    description: "Selección corta y bien elegida, por copa y por botella.",
    icon: "Wine",
    image: 6,
    products: [
      { name: "Tannat reserva (copa)", description: "El clásico uruguayo.", price: 34000, image: 14 },
      { name: "Tannat reserva (botella)", description: "750cc.", price: 145000 },
      { name: "Sauvignon blanc (copa)", description: "Fresco y cítrico.", price: 32000 },
      { name: "Espumante brut (copa)", description: "Método tradicional.", price: 38000 },
    ],
  },
  {
    slug: "sin-alcohol",
    name: "Bebidas sin alcohol",
    description: "Para acompañar sin resignar nada.",
    icon: "CupSoda",
    image: 7,
    products: [
      { name: "Limonada de la casa", description: "Con menta y jengibre.", price: 24000, tags: ["sin alcohol"] },
      { name: "Refrescos", description: "Línea completa, 500cc.", price: 16000, tags: ["sin alcohol"] },
      { name: "Agua mineral", description: "Con o sin gas, 500cc.", price: 13000, tags: ["sin alcohol"] },
      { name: "Café expreso", description: "De grano tostado en Montevideo.", price: 15000, tags: ["sin alcohol"] },
    ],
  },
];

const GALLERY = [
  { file: 1, alt: "Público durante un show en vivo en BARZUO", caption: "Sábado de tributo", tag: "shows", featured: true },
  { file: 2, alt: "Barra de BARZUO iluminada de noche", caption: "La barra", tag: "ambiente", featured: true },
  { file: 3, alt: "Banda tocando sobre el escenario principal", caption: "Escenario principal", tag: "shows", featured: true },
  { file: 4, alt: "Coctel de autor servido en la barra", caption: "Coctelería de autor", tag: "barra", featured: true },
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

const PROMOTIONS: Array<{
  slug: string;
  title: string;
  description: string;
  terms: string;
  type: PromotionType;
  value: number;
  image: number;
  maxPerCard: number;
  minTier?: "CLASICA" | "PLATA" | "ORO";
  pointsCost?: number;
  pointsReward?: number;
  weekdays?: number[];
  maxTotal?: number;
}> = [
  {
    slug: "2x1-en-chopps",
    title: "2x1 en chopps",
    description: "Llevate dos chopps de 500cc pagando uno, de 21:00 a 23:00.",
    terms:
      "Válido de martes a jueves, de 21:00 a 23:00. Un uso por tarjeta por noche. No acumulable con otras promociones.",
    type: "TWO_FOR_ONE",
    value: 0,
    image: 1,
    maxPerCard: 0,
    weekdays: [2, 3, 4],
    pointsReward: 20,
  },
  {
    slug: "20-off-en-cocteleria",
    title: "20% off en coctelería de autor",
    description: "Descuento sobre toda la carta de cocteles de autor.",
    terms:
      "Válido todos los días. Un uso por tarjeta. No aplica sobre promociones vigentes.",
    type: "PERCENT_OFF",
    value: 20,
    image: 2,
    maxPerCard: 1,
    pointsReward: 30,
  },
  {
    slug: "tabla-barzuo-bonificada",
    title: "Tabla BARZUO de cortesía",
    description: "Una tabla para compartir sin cargo con el consumo de cuatro tragos.",
    terms:
      "Requiere BarzuCard Plata. Un uso por tarjeta. Sujeto a disponibilidad de cocina.",
    type: "FREE_ITEM",
    value: 0,
    image: 3,
    maxPerCard: 1,
    minTier: "PLATA",
    pointsCost: 200,
  },
  {
    slug: "entrada-con-descuento",
    title: "$200 off en la entrada del show",
    description: "Descuento fijo sobre el valor de la entrada de cualquier show con costo.",
    terms:
      "Válido para shows con entrada paga. Un uso por tarjeta por show. Presentar antes de abonar.",
    type: "AMOUNT_OFF",
    value: 20000,
    image: 4,
    maxPerCard: 0,
    pointsReward: 25,
  },
  {
    slug: "cumpleanos-barzuo",
    title: "Brindis de cumpleaños",
    description: "Botella de espumante de la casa para tu mesa en la semana de tu cumpleaños.",
    terms:
      "Válido durante los siete días posteriores a la fecha de cumpleaños registrada. Un uso por año. Mesa de mínimo cuatro personas.",
    type: "FREE_ITEM",
    value: 0,
    image: 5,
    maxPerCard: 1,
    pointsReward: 50,
  },
  {
    slug: "noche-oro",
    title: "Whisky de autor bonificado",
    description: "Una copa de single malt 12 años de cortesía para socios Oro.",
    terms: "Exclusivo BarzuCard Oro. Un uso por mes. Sujeto a stock.",
    type: "FREE_ITEM",
    value: 0,
    image: 6,
    maxPerCard: 1,
    minTier: "ORO",
    pointsCost: 500,
    maxTotal: 100,
  },
];

// --- Seed --------------------------------------------------------------------

async function main() {
  console.log("Sembrando contenido de BARZUO…\n");

  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...SETTINGS },
    update: SETTINGS,
  });
  console.log("· Ajustes del sitio");

  // Usuarios del panel
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

  const staffEmail = (process.env.STAFF_EMAIL ?? "garzon@barzuo.com").toLowerCase();
  await prisma.user.upsert({
    where: { email: staffEmail },
    create: {
      email: staffEmail,
      name: "Garzón BARZUO",
      passwordHash: await bcrypt.hash(
        process.env.STAFF_PASSWORD ?? "Barzuo2024!",
        12,
      ),
      role: "STAFF",
    },
    update: { role: "STAFF", active: true },
  });
  console.log(`· Usuarios del panel (${adminEmail} / ${staffEmail})`);

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

  for (const [categoryIndex, category] of MENU.entries()) {
    const saved = await prisma.menuCategory.upsert({
      where: { slug: category.slug },
      create: {
        slug: category.slug,
        name: category.name,
        description: category.description,
        icon: category.icon,
        imageUrl: `/demo/category-${category.image}.jpg`,
        position: categoryIndex,
      },
      update: {
        name: category.name,
        description: category.description,
        icon: category.icon,
        imageUrl: `/demo/category-${category.image}.jpg`,
        position: categoryIndex,
        active: true,
      },
    });

    for (const [productIndex, product] of category.products.entries()) {
      const slug = `${category.slug}-${slugify(product.name)}`;
      const data = {
        categoryId: saved.id,
        name: product.name,
        description: product.description,
        priceCents: product.price,
        imageUrl: product.image ? `/demo/product-${product.image}.jpg` : null,
        featured: product.featured ?? false,
        position: productIndex,
        tags: product.tags ?? [],
        available: true,
      };

      await prisma.menuProduct.upsert({
        where: { slug },
        create: { slug, ...data },
        update: data,
      });
    }
  }
  console.log(
    `· Carta: ${MENU.length} categorías, ${MENU.reduce((n, c) => n + c.products.length, 0)} productos`,
  );

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
      minTier: promo.minTier ?? "CLASICA",
      maxPerCard: promo.maxPerCard,
      maxTotal: promo.maxTotal ?? 0,
      pointsCost: promo.pointsCost ?? 0,
      pointsReward: promo.pointsReward ?? 0,
      availableWeekdays: promo.weekdays ?? [],
    };

    await prisma.promotion.upsert({
      where: { slug: promo.slug },
      create: { slug: promo.slug, ...data },
      update: data,
    });
  }
  console.log(`· ${PROMOTIONS.length} promociones de BarzuCard`);

  // Socios de ejemplo, para probar la app del garzón de inmediato.
  const demoMembers = [
    { email: "sofia@ejemplo.com", fullName: "Sofía Ramírez", tier: "PLATA" as const, points: 620 },
    { email: "martin@ejemplo.com", fullName: "Martín Cabrera", tier: "CLASICA" as const, points: 120 },
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
          tier: member.tier,
          points: member.points,
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
