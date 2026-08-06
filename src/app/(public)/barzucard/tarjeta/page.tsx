import {
  ChevronDown,
  Download,
  LogOut,
  Printer,
  QrCode,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { logoutMember } from "@/app/actions/auth";
import { PaymentPanel } from "@/components/barzucard/payment-panel";
import { PromotionPicker } from "@/components/barzucard/promotion-picker";
import { VoucherCountdown } from "@/components/barzucard/voucher-countdown";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Reveal } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";
import { getMemberSession } from "@/lib/auth";
import { checkEligibility } from "@/lib/barzucard";
import { getActivePromotions, getSettings } from "@/lib/content";
import { formatCardNumber, formatDateTime, formatPrice } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { cardQrDataUrl } from "@/lib/qr";
import { getActiveVoucher } from "@/lib/vouchers";

export const metadata: Metadata = {
  title: "Mi BarzuCard",
  // Es un área privada: no debe indexarse.
  robots: { index: false, follow: false },
};

export default async function MiTarjetaPage({
  searchParams,
}: {
  searchParams: Promise<{ bienvenida?: string }>;
}) {
  const [session, { bienvenida }] = await Promise.all([
    getMemberSession(),
    searchParams,
  ]);

  if (!session) redirect("/barzucard/ingresar?volver=/barzucard/tarjeta");

  const [member, settings, promotions] = await Promise.all([
    prisma.member.findUnique({
      where: { id: session.memberId },
      include: {
        card: {
          include: {
            redemptions: {
              orderBy: { redeemedAt: "desc" },
              take: 10,
              include: { promotion: { select: { title: true } } },
            },
          },
        },
      },
    }),
    getSettings(),
    getActivePromotions(),
  ]);

  if (!member?.card) {
    // Situación excepcional: la sesión existe pero la tarjeta no.
    redirect("/barzucard/ingresar");
  }

  const card = member.card;

  const [qrDataUrl, activeVoucher] = await Promise.all([
    cardQrDataUrl(card.qrToken),
    getActiveVoucher(card.id),
  ]);

  // Cuántas veces usó cada promoción, para mostrar cuáles siguen disponibles.
  const usage = await prisma.redemption.groupBy({
    by: ["promotionId"],
    where: { cardId: card.id },
    _count: { promotionId: true },
  });
  const usageByPromotion = new Map(
    usage.map((entry) => [entry.promotionId, entry._count.promotionId]),
  );

  const available = promotions.filter(
    (promotion) =>
      checkEligibility({
        promotion,
        card: { status: card.status },
        redemptionsForThisPromotion: usageByPromotion.get(promotion.id) ?? 0,
      }).ok,
  );

  return (
    <>
      <PageHeader
        eyebrow={`Hola, ${member.fullName.split(" ")[0]}`}
        title="Tu BarzuCard"
        lead={
          bienvenida
            ? "¡Bienvenido al programa! Esta es tu tarjeta. Para usar un beneficio, elígelo abajo y te damos un QR propio de ese descuento."
            : "Elige abajo el beneficio que quieras usar: te damos un QR de ese descuento para mostrar en la barra."
        }
      />

      {/* Cupón abierto: es lo primero que hay que ver al volver a esta pantalla. */}
      {activeVoucher && (
        <div className="print-hidden container-bz -mt-8 sm:-mt-10">
          <Reveal className="flex flex-wrap items-center justify-between gap-4 border border-gilt/40 bg-gilt/8 px-5 py-4">
            <div className="min-w-0">
              <p className="eyebrow text-gilt-soft">Cupón listo para mostrar</p>
              <p className="mt-1.5 truncate font-display text-lg text-bone">
                {activeVoucher.promotion.title}
              </p>
              <VoucherCountdown
                expiresAt={activeVoucher.expiresAt.toISOString()}
                className="mt-1 block text-xs text-muted"
              />
            </div>

            <ButtonLink href={`/barzucard/canje/${activeVoucher.code}`} size="sm">
              <QrCode className="size-3.5" aria-hidden />
              Ver mi cupón
            </ButtonLink>
          </Reveal>
        </div>
      )}

      <Section className="container-bz">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,24rem)_1fr] lg:gap-14">
          {/* Columna de la tarjeta */}
          <div className="flex flex-col gap-5 lg:sticky lg:top-28 lg:self-start">
            {/*
              Un solo objeto para una sola cosa.

              Antes esta columna mostraba el QR grande sobre blanco y, debajo,
              la tarjeta dibujada —que lleva otro QR—: dos versiones de lo
              mismo, una encima de la otra, y ninguna de las dos se explicaba.
              Queda el QR funcional, que es el que se lee a media luz, con el
              nombre y el numero adentro.
            */}
            <div className="print-hidden flex flex-col items-center gap-4 rounded-2xl bg-white p-6 sm:p-8">
              <Image
                src={qrDataUrl}
                alt="Código QR de tu BarzuCard"
                width={512}
                height={512}
                unoptimized
                className="h-auto w-full max-w-[15rem]"
                preload
              />

              <div className="w-full border-t border-ink/10 pt-4 text-center">
                <p className="font-display text-lg leading-tight text-ink">
                  {member.fullName}
                </p>
                <p className="mt-1 font-mono text-sm tracking-[0.12em] text-ink/70">
                  {formatCardNumber(card.cardNumber)}
                </p>
              </div>

              <p className="text-center text-xs leading-relaxed text-ink/60">
                Muéstralo al pedir, no al pagar. Si el escáner falla, el equipo
                puede escribir el número.
              </p>
            </div>

            {card.status !== "ACTIVE" && (
              <p className="border border-crimson/50 bg-crimson/10 px-4 py-3 text-sm text-crimson-bright">
                Tu tarjeta está suspendida. Escríbenos para regularizarla.
              </p>
            )}

            {/* Guardar la imagen es lo mas parecido a "sumarla a la wallet"
                que se puede ofrecer sin certificados de Apple y Google: queda
                en la galeria del telefono y funciona sin conexion. */}
            <a
              href="/barzucard/tarjeta/imagen"
              download="barzucard.png"
              className="print-hidden inline-flex h-13 items-center justify-center gap-2 bg-crimson px-5 text-sm font-medium text-bone transition-colors hover:bg-crimson-bright"
            >
              <Download className="size-4" aria-hidden />
              Guardar en mi teléfono
            </a>

            {/* Lo de abajo se usa una vez cada mucho: no puede pesar lo mismo
                que el boton de arriba ni ocupar una fila cada uno. */}
            <div className="print-hidden flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted">
              <a
                href="/barzucard/tarjeta/imprimir"
                className="flex items-center gap-1.5 underline-offset-4 hover:text-bone-dim hover:underline"
              >
                <Printer className="size-3.5" aria-hidden />
                Imprimir
              </a>

              <span aria-hidden className="text-muted-dark">
                ·
              </span>

              <form action={logoutMember}>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 underline-offset-4 hover:text-crimson-bright hover:underline"
                >
                  <LogOut className="size-3.5" aria-hidden />
                  Cerrar sesión
                </button>
              </form>
            </div>

            <p className="print-hidden text-center text-xs text-muted-dark">
              {card.redemptions.length === 0
                ? "Todavía no usas ningún beneficio"
                : `${card.redemptions.length} ${card.redemptions.length === 1 ? "beneficio usado" : "beneficios usados"}`}
              {" · socio desde "}
              {new Intl.DateTimeFormat("es-CL", {
                month: "2-digit",
                year: "numeric",
              }).format(card.issuedAt)}
            </p>
          </div>

          {/* Lo que el socio viene a hacer */}
          <div className="print-hidden flex flex-col gap-10">
            <div>
              <h2 className="font-display text-xl text-bone">
                {available.length > 0
                  ? "Beneficios que puedes usar hoy"
                  : "Sin beneficios disponibles ahora"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {available.length > 0
                  ? "Pide el que quieras usar y te damos un QR de ese descuento, o muestra tu tarjeta y la garzona lo aplica en la mesa."
                  : "Vuelve a mirar más adelante: las promociones cambian seguido."}
              </p>

              {available.length > 0 ? (
                <div className="mt-6 grid gap-4 xl:grid-cols-2">
                  {available.map((promotion, index) => (
                    <Reveal key={promotion.id} delay={Math.min(index, 6) * 60} className="h-full">
                      <PromotionPicker promotion={promotion} compact />
                    </Reveal>
                  ))}
                </div>
              ) : (
                promotions.length > 0 && (
                  <div className="mt-6">
                    <ButtonLink href="/barzucard/promociones" variant="outline">
                      <Sparkles className="size-4" aria-hidden />
                      Ver todas las promociones
                    </ButtonLink>
                  </div>
                )
              )}
            </div>

            {/* Historial */}
            {card.redemptions.length > 0 && (
              <div>
                <h2 className="font-display text-xl text-bone">
                  Tus últimos canjes
                </h2>

                <ul className="mt-4 flex flex-col">
                  {card.redemptions.map((redemption) => (
                    <li
                      key={redemption.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-bone">
                          {redemption.promotion.title}
                        </p>
                        <p className="text-xs text-muted-dark">
                          {formatDateTime(redemption.redeemedAt)} ·{" "}
                          {redemption.receiptCode}
                        </p>
                      </div>

                      {redemption.discountCents > 0 && (
                        <span className="shrink-0 font-display text-emerald-300">
                          −{formatPrice(redemption.discountCents)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/*
              La tarjeta de plastico, plegada.

              Es opcional desde que el registro es gratis, pero ocupaba el
              lugar de honor de esta pantalla pidiendo una transferencia de
              $5.500 a alguien que ya tiene su tarjeta funcionando en el
              telefono. Queda a un toque para quien la quiera.
            */}
            {card.paymentStatus !== "DELIVERED" && (
              <details className="group border border-line bg-ink-soft">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="block text-base text-bone">
                      ¿La quieres de plástico?
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      Opcional · {formatPrice(settings.cardPriceCents)} · se
                      retira en el local
                    </span>
                  </span>
                  <ChevronDown
                    className="size-4 shrink-0 text-crimson transition-transform duration-300 group-open:rotate-180"
                    aria-hidden
                  />
                </summary>

                <div className="border-t border-line p-5">
                  <PaymentPanel
                    status={card.paymentStatus}
                    price={formatPrice(settings.cardPriceCents)}
                    paymentInfo={settings.cardPaymentInfo}
                    pickupInfo={settings.cardPickupInfo}
                    reference={card.paymentReference}
                  />
                </div>
              </details>
            )}
          </div>
        </div>
      </Section>

    </>
  );
}
