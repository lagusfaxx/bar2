import "server-only";

import { randomBytes, randomInt } from "node:crypto";

import type { CardTier, Promotion } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Prefijo fijo de la BarzuCard. Permite reconocer de un vistazo que un numero
 * pertenece al programa antes de consultar la base.
 */
const CARD_PREFIX = "5210";
const CARD_LENGTH = 16;

const TIER_ORDER: Record<CardTier, number> = {
  CLASICA: 0,
  PLATA: 1,
  ORO: 2,
};

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

/** Codigo corto e irrepetible del comprobante de canje (ej. "BZ-7K4M2Q"). */
export function generateReceiptCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin I, O, 0, 1
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[randomInt(0, alphabet.length)];
  }
  return `BZ-${code}`;
}

/** Normaliza lo que escribe el personal de sala: acepta espacios, guiones y la URL del QR. */
export function normalizeCardInput(raw: string) {
  const trimmed = raw.trim();

  // Si escanea el QR, el valor puede llegar como URL completa.
  const fromUrl = trimmed.match(/\/verificar\/([A-Za-z0-9_-]+)/);
  if (fromUrl) return { kind: "token" as const, value: fromUrl[1]! };

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === CARD_LENGTH) {
    return { kind: "number" as const, value: digits };
  }

  // Cualquier otra cosa se interpreta como token del QR.
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
    | "minTier"
    | "maxPerCard"
    | "maxTotal"
    | "redeemedCount"
    | "pointsCost"
    | "availableWeekdays"
  >;
  card: { tier: CardTier; status: string; points: number };
  redemptionsForThisPromotion: number;
  now?: Date;
};

export type Eligibility =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Unica fuente de verdad sobre si una promocion se puede canjear. La usan la
 * app del personal de sala (para habilitar el boton) y el canje real (para autorizarlo),
 * de modo que la pantalla nunca prometa algo que el servidor luego rechaza.
 */
export function checkEligibility({
  promotion,
  card,
  redemptionsForThisPromotion,
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

  if (TIER_ORDER[card.tier] < TIER_ORDER[promotion.minTier]) {
    return {
      ok: false,
      reason: `Requiere BarzuCard ${promotion.minTier.toLowerCase()}`,
    };
  }

  if (promotion.availableWeekdays.length > 0) {
    const weekday = weekdayInVenueTimeZone(now);
    if (!promotion.availableWeekdays.includes(weekday)) {
      return { ok: false, reason: "No disponible hoy" };
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

  if (promotion.pointsCost > 0 && card.points < promotion.pointsCost) {
    return {
      ok: false,
      reason: `Faltan ${promotion.pointsCost - card.points} puntos`,
    };
  }

  return { ok: true };
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

/** Umbrales de nivel. Al canjear se recalcula el tier del socio. */
export function tierForPoints(points: number): CardTier {
  if (points >= 1200) return "ORO";
  if (points >= 400) return "PLATA";
  return "CLASICA";
}
