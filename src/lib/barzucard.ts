import "server-only";

import { randomBytes, randomInt } from "node:crypto";

import type { Promotion } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Prefijo fijo de la BarzuCard. Permite reconocer de un vistazo que un numero
 * pertenece al programa antes de consultar la base.
 */
const CARD_PREFIX = "5210";
const CARD_LENGTH = 16;

/** Digito verificador de Luhn: detecta tipeos del personal de sala al cargar el numero. */
function luhnCheckDigit(digits: string) {
  let sum = 0;
  let double = true; // el proximo digito a la izquierda del verificador se dobla

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

export function isValidCardNumber(cardNumber: string) {
  const clean = cardNumber.replace(/\D/g, "");

  if (clean.length !== CARD_LENGTH) return false;
  if (!clean.startsWith(CARD_PREFIX)) return false;

  const body = clean.slice(0, CARD_LENGTH - 1);
  return luhnCheckDigit(body) === clean.slice(-1);
}

function buildCardNumber() {
  const randomLength = CARD_LENGTH - CARD_PREFIX.length - 1;
  let body = CARD_PREFIX;

  for (let i = 0; i < randomLength; i++) {
    body += randomInt(0, 10);
  }

  return body + luhnCheckDigit(body);
}

/** Numero unico de tarjeta, reintentando ante una colision improbable. */
export async function generateCardNumber() {
  for (let attempt = 0; attempt < 12; attempt++) {
    const candidate = buildCardNumber();
    const taken = await prisma.barzuCard.findUnique({
      where: { cardNumber: candidate },
      select: { id: true },
    });

    if (!taken) return candidate;
  }

  throw new Error("No fue posible generar un numero de BarzuCard unico");
}

/** Token opaco del QR. Se puede rotar si el socio pierde la tarjeta fisica. */
export function generateQrToken() {
  return randomBytes(24).toString("base64url");
}

/** Alfabeto de los codigos que se leen en voz alta: sin I, O, 0 ni 1. */
const READABLE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function readableCode(length: number) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += READABLE_ALPHABET[randomInt(0, READABLE_ALPHABET.length)];
  }
  return code;
}

/** Codigo corto e irrepetible del comprobante de canje (ej. "BZ-7K4M2Q"). */
export function generateReceiptCode() {
  return `BZ-${readableCode(6)}`;
}

/**
 * Codigo del cupon de descuento (ej. "BZD-4K7P2M").
 *
 * Se distingue a simple vista del comprobante: el cupon es lo que el socio
 * muestra antes del canje, el comprobante lo que queda despues.
 */
export function generateVoucherCode() {
  return `BZD-${readableCode(6)}`;
}

/** Token opaco del QR del cupon. */
export function generateVoucherToken() {
  return randomBytes(24).toString("base64url");
}

/**
 * Vigencia del cupon.
 *
 * El socio lo emite estando en el local, con el personal de sala cerca. Media hora
 * alcanza de sobra y evita que queden cupones abiertos de otra noche.
 */
export const VOUCHER_TTL_MINUTES = 30;

export function voucherExpiry(from: Date = new Date()) {
  return new Date(from.getTime() + VOUCHER_TTL_MINUTES * 60 * 1000);
}

/**
 * Normaliza lo que escribe o escanea el personal de sala.
 *
 * Puede llegar el numero de tarjeta, el QR de la tarjeta o el QR de un cupon de
 * descuento: los tres entran por el mismo campo y aca se decide cual es.
 */
export function normalizeCardInput(raw: string) {
  const trimmed = raw.trim();

  // QR de un cupon: lleva directo a la pantalla de ese descuento.
  const fromVoucherUrl = trimmed.match(/\/canjear\/([A-Za-z0-9_-]+)/);
  if (fromVoucherUrl) {
    return { kind: "voucher" as const, value: fromVoucherUrl[1]! };
  }

  // Codigo del cupon dictado o tipeado a mano.
  if (/^BZD-[A-Z0-9]{6}$/i.test(trimmed)) {
    return { kind: "voucherCode" as const, value: trimmed.toUpperCase() };
  }

  // Si escanea el QR de la tarjeta, el valor puede llegar como URL completa.
  const fromUrl = trimmed.match(/\/verificar\/([A-Za-z0-9_-]+)/);
  if (fromUrl) return { kind: "token" as const, value: fromUrl[1]! };

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === CARD_LENGTH) {
    return { kind: "number" as const, value: digits };
  }

  // Cualquier otra cosa se interpreta como token del QR de la tarjeta.
  return { kind: "token" as const, value: trimmed };
}

// --- Reglas de canje ---------------------------------------------------------

export type EligibilityInput = {
  promotion: Pick<
    Promotion,
    | "id"
    | "title"
    | "active"
    | "startsAt"
    | "endsAt"
    | "maxPerCard"
    | "maxTotal"
    | "redeemedCount"
    | "availableWeekdays"
    | "birthdayOnly"
    | "birthdayWindowDays"
  >;
  card: { status: string };
  redemptionsForThisPromotion: number;
  /*
   * Fecha de nacimiento del socio.
   *
   * Obligatoria aunque casi ninguna promocion la use. Si fuera opcional, los
   * nueve lugares que ya llamaban a esta funcion seguirian compilando sin
   * pasarla y toda promocion de cumpleanos quedaria muda: nunca canjeable, sin
   * error, sin aviso, y con el motivo escondido en un valor por defecto. Que el
   * compilador obligue a decir `null` es la unica forma de que agregar un
   * llamador nuevo no reviva ese silencio.
   */
  birthDate: Date | null;
  now?: Date;
};

export type Eligibility =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Unica fuente de verdad sobre si una promocion se puede canjear: vigencia,
 * dia habilitado y topes de uso. La usan la app de sala (para habilitar el
 * boton) y el canje real (para autorizarlo), de modo que la pantalla nunca
 * prometa algo que el servidor luego rechaza.
 *
 * Lo que NO decide es cuanto descuenta: de eso se ocupa `resolvePromotion` en
 * lib/promotions.ts, contra las lineas de la mesa.
 */
export function checkEligibility({
  promotion,
  card,
  redemptionsForThisPromotion,
  birthDate,
  now = new Date(),
}: EligibilityInput): Eligibility {
  if (card.status !== "ACTIVE") {
    return { ok: false, reason: "La tarjeta esta suspendida" };
  }

  if (!promotion.active) {
    return { ok: false, reason: "La promocion no esta activa" };
  }

  if (promotion.startsAt > now) {
    return { ok: false, reason: "La promocion todavia no comenzo" };
  }

  if (promotion.endsAt && promotion.endsAt < now) {
    return { ok: false, reason: "La promocion ya vencio" };
  }

  if (promotion.availableWeekdays.length > 0) {
    const weekday = weekdayInVenueTimeZone(now);
    if (!promotion.availableWeekdays.includes(weekday)) {
      return { ok: false, reason: "No disponible hoy" };
    }
  }

  /*
   * Promocion de cumpleanos.
   *
   * Se comprueba contra el dia y el mes, nunca contra el ano: la gracia es que
   * se repita todos los anos. Y con una ventana de dias alrededor, porque nadie
   * sale a celebrar necesariamente el mismo dia — un cumpleanos de martes se
   * festeja el viernes, y un beneficio que vence a medianoche del martes no lo
   * usa nadie.
   */
  if (promotion.birthdayOnly) {
    if (!birthDate) {
      return { ok: false, reason: "El socio no registro su fecha de nacimiento" };
    }

    if (!withinBirthdayWindow(birthDate, now, promotion.birthdayWindowDays)) {
      return { ok: false, reason: "Solo para el cumpleanos del socio" };
    }
  }

  if (promotion.maxTotal > 0 && promotion.redeemedCount >= promotion.maxTotal) {
    return { ok: false, reason: "Se agotaron los cupos" };
  }

  if (
    promotion.maxPerCard > 0 &&
    redemptionsForThisPromotion >= promotion.maxPerCard
  ) {
    return {
      ok: false,
      reason:
        promotion.maxPerCard === 1
          ? "Ya fue canjeada con esta tarjeta"
          : `Limite de ${promotion.maxPerCard} usos alcanzado`,
    };
  }

  return { ok: true };
}

/**
 * ¿Esta el socio de cumpleanos, con la ventana puesta?
 *
 * Se compara por dia de calendario y no por milisegundos. Restar fechas
 * directamente parece equivalente y no lo es: el ancla del cumpleanos cae a
 * medianoche y el momento actual cae a cualquier hora, asi que una ventana de
 * cero dias —"solo el dia exacto"— no coincidia nunca, y un cumpleanos del 29
 * de febrero en un ano no bisiesto tampoco.
 *
 * El "hoy" se toma en la hora del local y no en UTC. En Chile son tres o
 * cuatro horas de diferencia: sin esto, entre medianoche y las cuatro de la
 * manana —que en un bar es horario de trabajo— el sistema ya estaria en el dia
 * siguiente y el cumpleanos del socio que tiene delante habria terminado.
 *
 * El dia y el mes salen de la fecha guardada tal cual, sin corregir por zona:
 * es una fecha de calendario, no un instante. El 29 de febrero cae en el 1 de
 * marzo los anos que no son bisiestos, que es lo que hace `Date` solo y
 * tambien lo que hace el registro civil.
 */
export function withinBirthdayWindow(
  birthDate: Date,
  now: Date,
  windowDays: number,
) {
  const hoy = venueCalendarDay(now);
  const margen = Math.max(0, windowDays);

  const dia = birthDate.getUTCDate();
  const mes = birthDate.getUTCMonth();

  /*
   * Se prueba contra tres anos, no contra uno.
   *
   * Es lo que hace que la ventana sobreviva a Ano Nuevo: un cumpleanos del 2
   * de enero tiene que seguir vigente el 30 de diciembre, y uno del 29 de
   * diciembre el 3 de enero. Mirando solo el ano en curso, la ventana se corta
   * al cambiar de ano.
   */
  const ano = new Date(hoy).getUTCFullYear();

  return [ano - 1, ano, ano + 1].some((candidato) => {
    const cumple = Date.UTC(candidato, mes, dia);
    const dias = Math.round((hoy - cumple) / 86_400_000);

    return Math.abs(dias) <= margen;
  });
}

/**
 * El dia de calendario del local, como marca de tiempo a medianoche UTC.
 *
 * Sirve de ancla comparable: dos fechas convertidas asi se restan y dan dias
 * enteros, sin que la hora del dia meta ruido.
 */
function venueCalendarDay(date: Date) {
  const timeZone = process.env.NEXT_PUBLIC_TIME_ZONE ?? "America/Santiago";

  // en-CA da "2026-06-12", que es el unico formato que se parte sin ambiguedad.
  const [ano, mes, dia] = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .split("-")
    .map(Number);

  return Date.UTC(ano, mes - 1, dia);
}

/** Dia de la semana (0=domingo) en la zona horaria del local, no en UTC. */
function weekdayInVenueTimeZone(date: Date) {
  const timeZone = process.env.NEXT_PUBLIC_TIME_ZONE ?? "America/Santiago";
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);

  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(label);
}
