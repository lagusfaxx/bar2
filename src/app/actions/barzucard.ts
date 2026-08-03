"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getMemberSession } from "@/lib/auth";
import {
  checkEligibility,
  generateVoucherCode,
  generateVoucherToken,
  voucherExpiry,
} from "@/lib/barzucard";
import { formError, type FormState } from "@/lib/form-state";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Acciones del area de socio de la BarzuCard.
 *
 * Aca vive el paso que faltaba: el socio elige el descuento que quiere usar y
 * se lleva un QR propio de ese descuento. El equipo de sala ya no tiene que
 * adivinar cual es —lo lee al escanear— y solo confirma.
 */

/** Cupon vigente de una tarjeta, si lo hay, con la promocion resuelta. */
async function findPendingVoucher(cardId: string, promotionId?: string) {
  return prisma.promotionVoucher.findFirst({
    where: {
      cardId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
      ...(promotionId ? { promotionId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Emite el cupon del descuento elegido.
 *
 * Se valida lo mismo que valida la barra al canjear: si la promocion no se
 * puede usar, el socio se entera aca y no frente al garzon. La comprobacion
 * definitiva vuelve a correr al confirmar el canje, porque entre un momento y
 * otro puede agotarse el cupo.
 */
export async function requestVoucher(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await getMemberSession();

  if (!session) {
    redirect("/barzucard/ingresar?volver=/barzucard/tarjeta");
  }

  const promotionId = formData.get("promotionId");

  if (typeof promotionId !== "string" || !promotionId) {
    return formError("Elige una promoción para canjear.");
  }

  const ip = await clientIp();
  const limit = rateLimit(`voucher:${ip}`, 20, 60 * 10);

  if (!limit.ok) {
    return formError("Pediste varios cupones seguidos. Espera un momento.");
  }

  const [card, promotion] = await Promise.all([
    prisma.barzuCard.findUnique({
      where: { memberId: session.memberId },
      select: { id: true, tier: true, status: true, points: true },
    }),
    prisma.promotion.findUnique({ where: { id: promotionId } }),
  ]);

  if (!card) redirect("/barzucard/ingresar");
  if (!promotion) return formError("Esa promoción ya no está disponible.");

  const used = await prisma.redemption.count({
    where: { cardId: card.id, promotionId },
  });

  const eligibility = checkEligibility({
    promotion,
    card,
    redemptionsForThisPromotion: used,
  });

  if (!eligibility.ok) {
    return formError(eligibility.reason);
  }

  // Si ya pidio este mismo descuento y sigue vigente, se le devuelve el mismo
  // cupon: dos QR distintos para lo mismo solo confunden en la barra.
  const existing = await findPendingVoucher(card.id, promotionId);

  if (existing) {
    redirect(`/barzucard/canje/${existing.code}`);
  }

  const voucher = await prisma.promotionVoucher.create({
    data: {
      code: generateVoucherCode(),
      token: generateVoucherToken(),
      promotionId,
      cardId: card.id,
      expiresAt: voucherExpiry(),
    },
    select: { code: true },
  });

  revalidatePath("/barzucard/tarjeta");

  redirect(`/barzucard/canje/${voucher.code}`);
}

/** Da de baja un cupon que el socio ya no quiere usar. */
export async function cancelVoucher(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await getMemberSession();

  if (!session) {
    redirect("/barzucard/ingresar?volver=/barzucard/tarjeta");
  }

  const code = formData.get("code");

  if (typeof code !== "string" || !code) {
    return formError("No encontramos ese cupón.");
  }

  const voucher = await prisma.promotionVoucher.findUnique({
    where: { code },
    select: { id: true, status: true, card: { select: { memberId: true } } },
  });

  // Un cupon ajeno se responde igual que uno inexistente: no confirmamos que
  // el codigo exista.
  if (!voucher || voucher.card.memberId !== session.memberId) {
    return formError("No encontramos ese cupón.");
  }

  if (voucher.status !== "PENDING") {
    return formError("Ese cupón ya no está activo.");
  }

  await prisma.promotionVoucher.update({
    where: { id: voucher.id },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/barzucard/tarjeta");

  redirect("/barzucard/tarjeta");
}
