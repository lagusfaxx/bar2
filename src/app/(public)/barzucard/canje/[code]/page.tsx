import { ArrowLeft, CheckCircle2, Info, Star } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";

import { VoucherCancel } from "@/components/barzucard/voucher-cancel";
import { VoucherCountdown } from "@/components/barzucard/voucher-countdown";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Section } from "@/components/ui/section";
import { getMemberSession } from "@/lib/auth";
import { formatCardNumber, promotionValueLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { voucherQrDataUrl } from "@/lib/qr";
import { lookupVoucher } from "@/lib/vouchers";

export const metadata: Metadata = {
  title: "Tu cupón de descuento",
  // Area privada del socio: no debe indexarse.
  robots: { index: false, follow: false },
};

/**
 * El cupon del descuento que el socio eligio.
 *
 * Es la pantalla que se le muestra al equipo de sala: un QR propio de esta
 * promocion, distinto del de la tarjeta. Al escanearlo, el garzon cae directo
 * en la confirmacion de este descuento y no tiene que elegir nada.
 */
export default async function CanjePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const [{ code }, session] = await Promise.all([params, getMemberSession()]);

  if (!session) {
    redirect(
      `/barzucard/ingresar?volver=${encodeURIComponent(`/barzucard/canje/${code}`)}`,
    );
  }

  // El cupon es del socio o no existe: no se confirma que el codigo sea real.
  const owner = await prisma.promotionVoucher.findUnique({
    where: { code: code.toUpperCase() },
    select: { card: { select: { memberId: true } } },
  });

  if (!owner || owner.card.memberId !== session.memberId) notFound();

  const voucher = await lookupVoucher({ code: code.toUpperCase() });

  if (!voucher) notFound();

  const usable = voucher.status === "PENDING" && !voucher.blockedReason;
  const qrDataUrl = usable ? await voucherQrDataUrl(voucher.token) : null;

  return (
    <Section className="container-bz">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8">
        <ButtonLink href="/barzucard/tarjeta" variant="ghost" size="sm" className="self-start">
          <ArrowLeft className="size-3.5" aria-hidden />
          Mi BarzuCard
        </ButtonLink>

        {/* Qué eligió canjear */}
        <div className="text-center">
          <Badge tone="crimson">
            {promotionValueLabel(voucher.promotion.type, voucher.promotion.value)}
          </Badge>

          <h1 className="mt-4 font-display text-[clamp(1.75rem,6vw,2.5rem)] leading-tight text-bone">
            {voucher.promotion.title}
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-muted">
            {voucher.promotion.description}
          </p>
        </div>

        {qrDataUrl ? (
          <>
            {/* El QR sobre fondo claro: se lee mejor desde otra pantalla. */}
            <div className="mx-auto w-full max-w-xs bg-bone p-5">
              <Image
                src={qrDataUrl}
                alt={`Código QR del cupón ${voucher.code}`}
                width={640}
                height={640}
                unoptimized
                className="h-auto w-full"
              />
            </div>

            <div className="text-center">
              <p className="font-mono text-lg tracking-[0.24em] text-bone">
                {voucher.code}
              </p>
              <VoucherCountdown
                expiresAt={voucher.expiresAt}
                className="mt-2 block text-xs text-muted"
              />
            </div>

            <p className="flex items-start gap-2.5 border border-line bg-ink-soft px-4 py-3 text-xs leading-relaxed text-muted">
              <Info className="mt-0.5 size-3.5 shrink-0 text-crimson-bright" aria-hidden />
              Muéstrale esta pantalla a quien te atiende. Al escanear el código ya
              sabe qué descuento elegiste y solo tiene que confirmarlo.
            </p>
          </>
        ) : (
          <div
            className={
              voucher.status === "REDEEMED"
                ? "border border-emerald-500/40 bg-emerald-500/10 p-6 text-center"
                : "border border-crimson/50 bg-crimson/10 p-6 text-center"
            }
          >
            {voucher.status === "REDEEMED" ? (
              <>
                <CheckCircle2
                  className="mx-auto size-8 text-emerald-300"
                  aria-hidden
                />
                <p className="mt-3 font-display text-xl text-emerald-200">
                  Cupón canjeado
                </p>
                {voucher.receiptCode && (
                  <p className="mt-2 font-mono text-sm tracking-[0.18em] text-emerald-300">
                    {voucher.receiptCode}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="font-display text-xl text-crimson-bright">
                  {voucher.blockedReason ?? "El cupón ya no está disponible"}
                </p>
                <p className="mt-2 text-sm text-muted">
                  Puedes elegir otro beneficio desde tu tarjeta.
                </p>
              </>
            )}
          </div>
        )}

        {voucher.promotion.terms && (
          <p className="border-t border-line pt-5 text-xs leading-relaxed text-muted-dark">
            {voucher.promotion.terms}
          </p>
        )}

        {/* A quién pertenece: el equipo de sala lo contrasta con la tarjeta. */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-xs text-muted-dark">
          <span>{voucher.member.fullName}</span>
          <span className="font-mono tracking-[0.14em]">
            {formatCardNumber(voucher.card.cardNumber)}
          </span>
        </div>

        {(voucher.promotion.pointsCost > 0 ||
          voucher.promotion.pointsReward > 0) && (
          <p className="flex items-center gap-2 text-xs text-gilt-soft">
            <Star className="size-3.5" aria-hidden />
            {voucher.promotion.pointsCost > 0 &&
              `Al canjearlo se descuentan ${voucher.promotion.pointsCost} puntos`}
            {voucher.promotion.pointsCost > 0 &&
              voucher.promotion.pointsReward > 0 &&
              " · "}
            {voucher.promotion.pointsReward > 0 &&
              `Suma ${voucher.promotion.pointsReward} puntos`}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/barzucard/tarjeta" variant="outline" size="sm">
            Volver a mi tarjeta
          </ButtonLink>

          {usable && <VoucherCancel code={voucher.code} />}
        </div>
      </div>
    </Section>
  );
}
