import "server-only";

import { checkEligibility } from "@/lib/barzucard";
import { prisma } from "@/lib/prisma";

/**
 * Lectura de los cupones de descuento de la BarzuCard.
 *
 * Vive fuera de las Server Actions a proposito: lo consultan componentes de
 * servidor (la pantalla del socio y la del equipo de sala) y no tiene por que
 * quedar expuesto como endpoint.
 */

export type VoucherLookup = {
  code: string;
  token: string;
  status: string;
  expiresAt: string;
  promotion: {
    title: string;
    description: string;
    terms: string | null;
    type: string;
    value: number;
    pointsCost: number;
    pointsReward: number;
  };
  card: {
    cardNumber: string;
    tier: string;
    status: string;
    points: number;
  };
  member: { fullName: string };
  /** Si no se puede canjear, el motivo, ya resuelto en el servidor. */
  blockedReason?: string;
  /** Comprobante, cuando el cupon ya fue canjeado. */
  receiptCode?: string;
};

type Where = { token: string } | { code: string };

/**
 * Resuelve un cupon a partir del token del QR o de su codigo legible.
 *
 * Devuelve todo resuelto —promocion, socio y si se puede canjear— para que la
 * pantalla no tenga que decidir nada: el garzon ve un solo boton.
 */
export async function lookupVoucher(where: Where): Promise<VoucherLookup | null> {
  const voucher = await prisma.promotionVoucher.findUnique({
    where: where as { token: string } & { code: string },
    include: {
      promotion: true,
      redemption: { select: { receiptCode: true } },
      card: { include: { member: { select: { fullName: true } } } },
    },
  });

  if (!voucher) return null;

  const now = new Date();
  let status: string = voucher.status;

  // Un cupon vencido se marca al leerlo: asi tambien lo ve caducado el socio en
  // su pantalla y no se lo muestra al garzon como si sirviera.
  if (voucher.status === "PENDING" && voucher.expiresAt < now) {
    await prisma.promotionVoucher.update({
      where: { id: voucher.id },
      data: { status: "EXPIRED" },
    });
    status = "EXPIRED";
  }

  const used = await prisma.redemption.count({
    where: { cardId: voucher.cardId, promotionId: voucher.promotionId },
  });

  const eligibility = checkEligibility({
    promotion: voucher.promotion,
    card: voucher.card,
    redemptionsForThisPromotion: used,
    now,
  });

  const blockedReason =
    status === "REDEEMED"
      ? "Este cupón ya fue canjeado"
      : status === "EXPIRED"
        ? "El cupón venció"
        : status === "CANCELLED"
          ? "El socio dio de baja este cupón"
          : eligibility.ok
            ? undefined
            : eligibility.reason;

  return {
    code: voucher.code,
    token: voucher.token,
    status,
    expiresAt: voucher.expiresAt.toISOString(),
    promotion: {
      title: voucher.promotion.title,
      description: voucher.promotion.description,
      terms: voucher.promotion.terms,
      type: voucher.promotion.type,
      value: voucher.promotion.value,
      pointsCost: voucher.promotion.pointsCost,
      pointsReward: voucher.promotion.pointsReward,
    },
    card: {
      cardNumber: voucher.card.cardNumber,
      tier: voucher.card.tier,
      status: voucher.card.status,
      points: voucher.card.points,
    },
    member: { fullName: voucher.card.member.fullName },
    blockedReason,
    receiptCode: voucher.redemption?.receiptCode,
  };
}

/**
 * Cupon vigente de una tarjeta, para avisarle al socio que ya tiene uno abierto
 * en vez de dejarlo emitir otro.
 */
export async function getActiveVoucher(cardId: string) {
  return prisma.promotionVoucher.findFirst({
    where: { cardId, status: "PENDING", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    include: { promotion: { select: { title: true } } },
  });
}
