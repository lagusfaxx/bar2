"use server";

import { revalidatePath } from "next/cache";

import type { CardStatus } from "@/generated/prisma/enums";
import { requireCmsUser, requireStaff } from "@/lib/auth";
import {
  checkEligibility,
  generateQrToken,
  generateReceiptCode,
  isValidCardNumber,
  normalizeCardInput,
  tierForPoints,
} from "@/lib/barzucard";
import { revalidateContent } from "@/lib/cache";
import { formError, formSuccess, type FormState } from "@/lib/form-state";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";

import { recordAudit } from "./audit";

// --- Administración de tarjetas ---------------------------------------------

export async function setCardStatus(cardId: string, status: CardStatus) {
  const session = await requireCmsUser();

  const card = await prisma.barzuCard.update({
    where: { id: cardId },
    data: { status },
    select: { cardNumber: true },
  });

  await recordAudit(
    session.userId,
    "update",
    "BarzuCard",
    cardId,
    `Tarjeta ${card.cardNumber} ${status === "ACTIVE" ? "reactivada" : "suspendida"}`,
  );

  revalidatePath("/admin/tarjetas");
}

/**
 * Emite un QR nuevo. Se usa cuando el socio pierde la tarjeta física: el código
 * anterior deja de validar de inmediato.
 */
export async function regenerateCardQr(cardId: string) {
  const session = await requireCmsUser();

  const card = await prisma.barzuCard.update({
    where: { id: cardId },
    data: { qrToken: generateQrToken(), printedAt: null },
    select: { cardNumber: true },
  });

  await recordAudit(
    session.userId,
    "update",
    "BarzuCard",
    cardId,
    `QR regenerado para la tarjeta ${card.cardNumber}`,
  );

  revalidatePath("/admin/tarjetas");
}

export async function markCardPrinted(cardId: string) {
  await requireCmsUser();

  await prisma.barzuCard.update({
    where: { id: cardId },
    data: { printedAt: new Date() },
  });

  revalidatePath("/admin/tarjetas");
}

// --- App de verificación (equipo de sala) ------------------------------------

export type CardLookup = {
  card: {
    id: string;
    cardNumber: string;
    tier: string;
    status: string;
    points: number;
  };
  member: { fullName: string; email: string };
  promotions: Array<{
    id: string;
    title: string;
    description: string;
    terms: string | null;
    type: string;
    value: number;
    pointsCost: number;
    pointsReward: number;
    used: number;
    maxPerCard: number;
    eligible: boolean;
    reason?: string;
  }>;
  lastRedemptions: Array<{
    id: string;
    title: string;
    redeemedAt: string;
    receiptCode: string;
  }>;
};

/**
 * Busca una tarjeta por número o por el token del QR y devuelve, para cada
 * promoción vigente, si se puede canjear ahora mismo y por qué no en caso
 * contrario. La app del garzón solo pinta este resultado: toda la decisión se
 * toma en el servidor.
 */
export async function lookupCard(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const ip = await clientIp();
  const limit = rateLimit(`lookup:${ip}`, 120, 60 * 5);

  if (!limit.ok) {
    return formError("Demasiadas consultas seguidas. Espera un momento.");
  }

  const raw = formData.get("code");

  if (typeof raw !== "string" || raw.trim().length < 4) {
    return formError("Ingresa el número de tarjeta o escanea el QR.");
  }

  const parsed = normalizeCardInput(raw);

  if (parsed.kind === "number" && !isValidCardNumber(parsed.value)) {
    return formError(
      "El número no corresponde a una BarzuCard. Revisa los 16 dígitos.",
    );
  }

  const card = await prisma.barzuCard.findUnique({
    where:
      parsed.kind === "number"
        ? { cardNumber: parsed.value }
        : { qrToken: parsed.value },
    include: {
      member: { select: { fullName: true, email: true } },
      redemptions: {
        orderBy: { redeemedAt: "desc" },
        take: 5,
        include: { promotion: { select: { title: true } } },
      },
    },
  });

  if (!card) {
    return formError("No encontramos ninguna tarjeta con ese código.");
  }

  const now = new Date();

  const promotions = await prisma.promotion.findMany({
    where: {
      active: true,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gte: now } }],
    },
    orderBy: { position: "asc" },
  });

  // Cuántas veces usó esta tarjeta cada promoción.
  const usage = await prisma.redemption.groupBy({
    by: ["promotionId"],
    where: { cardId: card.id },
    _count: { promotionId: true },
  });

  const usageByPromotion = new Map(
    usage.map((entry) => [entry.promotionId, entry._count.promotionId]),
  );

  const result: CardLookup = {
    card: {
      id: card.id,
      cardNumber: card.cardNumber,
      tier: card.tier,
      status: card.status,
      points: card.points,
    },
    member: card.member,
    promotions: promotions.map((promotion) => {
      const used = usageByPromotion.get(promotion.id) ?? 0;
      const eligibility = checkEligibility({
        promotion,
        card: { tier: card.tier, status: card.status, points: card.points },
        redemptionsForThisPromotion: used,
        now,
      });

      return {
        id: promotion.id,
        title: promotion.title,
        description: promotion.description,
        terms: promotion.terms,
        type: promotion.type,
        value: promotion.value,
        pointsCost: promotion.pointsCost,
        pointsReward: promotion.pointsReward,
        used,
        maxPerCard: promotion.maxPerCard,
        eligible: eligibility.ok,
        reason: eligibility.ok ? undefined : eligibility.reason,
      };
    }),
    lastRedemptions: card.redemptions.map((redemption) => ({
      id: redemption.id,
      title: redemption.promotion.title,
      redeemedAt: redemption.redeemedAt.toISOString(),
      receiptCode: redemption.receiptCode,
    })),
  };

  return formSuccess("Tarjeta encontrada.", {
    lookup: result as unknown as Record<string, unknown>,
  });
}

/**
 * Registra el canje.
 *
 * Se vuelve a comprobar la elegibilidad dentro de una transacción, con el
 * contador de usos leído en ese mismo momento: sin esto, dos garzones podrían
 * canjear a la vez una promoción de un solo uso.
 */
export async function redeemPromotion(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireStaff();

  const cardId = formData.get("cardId");
  const promotionId = formData.get("promotionId");
  const note = formData.get("note");

  if (typeof cardId !== "string" || typeof promotionId !== "string") {
    return formError("Faltan datos del canje.");
  }

  const ip = await clientIp();
  const limit = rateLimit(`redeem:${ip}`, 60, 60 * 5);

  if (!limit.ok) {
    return formError("Demasiados canjes seguidos. Espera un momento.");
  }

  try {
    const receipt = await prisma.$transaction(async (tx) => {
      const [card, promotion] = await Promise.all([
        tx.barzuCard.findUnique({
          where: { id: cardId },
          select: { id: true, tier: true, status: true, points: true },
        }),
        tx.promotion.findUnique({ where: { id: promotionId } }),
      ]);

      if (!card) throw new Error("La tarjeta ya no existe.");
      if (!promotion) throw new Error("La promoción ya no está disponible.");

      const used = await tx.redemption.count({
        where: { cardId, promotionId },
      });

      const eligibility = checkEligibility({
        promotion,
        card,
        redemptionsForThisPromotion: used,
      });

      if (!eligibility.ok) {
        throw new Error(eligibility.reason);
      }

      const receiptCode = generateReceiptCode();

      await tx.redemption.create({
        data: {
          cardId,
          promotionId,
          staffUserId: session.userId,
          receiptCode,
          note: typeof note === "string" && note ? note.slice(0, 200) : null,
          pointsSpent: promotion.pointsCost,
          pointsEarned: promotion.pointsReward,
        },
      });

      await tx.promotion.update({
        where: { id: promotionId },
        data: { redeemedCount: { increment: 1 } },
      });

      const points =
        card.points - promotion.pointsCost + promotion.pointsReward;

      await tx.barzuCard.update({
        where: { id: cardId },
        data: { points, tier: tierForPoints(points) },
      });

      return { receiptCode, points };
    });

    await recordAudit(
      session.userId,
      "redeem",
      "Redemption",
      undefined,
      `Canje ${receipt.receiptCode}`,
    );

    revalidatePath("/admin/canjes");
    revalidateContent("promotions");

    return formSuccess(`Canje confirmado · ${receipt.receiptCode}`, {
      receiptCode: receipt.receiptCode,
      points: receipt.points,
    });
  } catch (error) {
    return formError(
      error instanceof Error
        ? error.message
        : "No se pudo registrar el canje. Prueba de nuevo.",
    );
  }
}
