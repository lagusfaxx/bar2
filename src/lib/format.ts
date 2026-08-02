const LOCALE = "es-UY";
const TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE ?? "America/Montevideo";
const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "UYU";

/** Precios se guardan en centesimos para evitar errores de coma flotante. */
export function formatPrice(cents: number | null | undefined) {
  if (cents == null) return "";

  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatDate(date: Date | string, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
    ...opts,
  }).format(new Date(date));
}

export function formatTime(date: Date | string) {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string) {
  return `${formatDate(date)} · ${formatTime(date)}`;
}

/** Partes sueltas para maquetar fechas (ej. el bloque del afiche). */
export function dateParts(date: Date | string) {
  const value = new Date(date);
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, ...opts }).format(value);

  return {
    day: fmt({ day: "2-digit" }),
    month: fmt({ month: "short" }).replace(".", "").toUpperCase(),
    monthLong: fmt({ month: "long" }),
    weekday: fmt({ weekday: "long" }),
    weekdayShort: fmt({ weekday: "short" }).replace(".", "").toUpperCase(),
    year: fmt({ year: "numeric" }),
    time: formatTime(value),
  };
}

/** Clave YYYY-MM-DD en la zona horaria del local (no en UTC). */
export function dayKey(date: Date | string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

export function relativeDay(date: Date | string) {
  const today = dayKey(new Date());
  const target = dayKey(date);

  if (target === today) return "Hoy";

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (target === dayKey(tomorrow)) return "Mañana";

  return null;
}

/** "4521 8890 1234 5678" — formato legible del numero de BarzuCard. */
export function formatCardNumber(cardNumber: string) {
  return cardNumber.replace(/(.{4})/g, "$1 ").trim();
}

export const EVENT_CATEGORY_LABELS: Record<string, string> = {
  TRIBUTO: "Tributo",
  EN_VIVO: "En vivo",
  DJ: "DJ set",
  KARAOKE: "Karaoke",
  STANDUP: "Stand up",
  FIESTA: "Fiesta",
  ESPECIAL: "Especial",
};

export const PROMOTION_TYPE_LABELS: Record<string, string> = {
  PERCENT_OFF: "Descuento %",
  AMOUNT_OFF: "Descuento fijo",
  TWO_FOR_ONE: "2x1",
  FREE_ITEM: "Cortesía",
  OTHER: "Beneficio",
};

export const TIER_LABELS: Record<string, string> = {
  CLASICA: "Clásica",
  PLATA: "Plata",
  ORO: "Oro",
};

export const WEEKDAY_LABELS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

/** Texto corto del beneficio, según el tipo de promoción. */
export function promotionValueLabel(type: string, value: number) {
  switch (type) {
    case "PERCENT_OFF":
      return `${value}% OFF`;
    case "AMOUNT_OFF":
      return `${formatPrice(value)} OFF`;
    case "TWO_FOR_ONE":
      return "2x1";
    case "FREE_ITEM":
      return "Cortesía";
    default:
      return "Beneficio";
  }
}
