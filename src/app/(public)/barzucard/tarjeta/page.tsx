import { Download, LogOut, Printer, QrCode, Sparkles } from "lucide-react";
import Image from "next/image";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { logoutMember } from "@/app/actions/auth";
import { CardVisual } from "@/components/barzucard/card-visual";
import { PaymentPanel } from "@/components/barzucard/payment-panel";
import { PromotionPicker } from "@/components/barzucard/promotion-picker";
import { VoucherCountdown } from "@/components/barzucard/voucher-countdown";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Reveal } from "@/components/ui/reveal";
import { Section, SectionHeading, Badge } from "@/components/ui/section";
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
        <div className="grid gap-12 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-16">
          {/* Tarjeta */}
          <div>
            {/* El QR grande va primero: es lo unico que se usa en la barra, y
                a media luz y con el telefono en la mano tiene que leerse de
                una pasada. La tarjeta queda debajo, como respaldo visual. */}
            <div className="print-hidden mb-8 flex flex-col items-center gap-4 rounded-2xl bg-white p-6 sm:p-8">
              <Image
                src={qrDataUrl}
                alt="Código QR de tu BarzuCard"
                width={512}
                height={512}
                unoptimized
                className="h-auto w-full max-w-[17rem]"
                preload
              />
              <p className="text-center font-mono text-base tracking-[0.12em] text-ink">
                {formatCardNumber(card.cardNumber)}
              </p>
              <p className="text-center text-sm text-ink/70">
                Muéstralo en la barra. Si el escáner falla, el equipo puede
                escribir este número.
              </p>
            </div>

            <Reveal>
              <CardVisual
                cardNumber={card.cardNumber}
                holder={member.fullName}
                qrDataUrl={qrDataUrl}
                issuedAt={card.issuedAt}
                status={card.status}
                barName={settings.barName}
              />
            </Reveal>

            {/* Guardar la imagen es lo mas parecido a "sumarla a la wallet"
                que se puede ofrecer sin certificados de Apple y Google: queda
                en la galeria del telefono y funciona sin conexion. */}
            <div className="print-hidden mt-6 grid gap-3 sm:grid-cols-2">
              <a
                href="/barzucard/tarjeta/imagen"
                download="barzucard.png"
                className="inline-flex h-12 items-center justify-center gap-2 bg-crimson px-5 text-sm font-medium text-bone transition-colors hover:bg-crimson-bright"
              >
                <Download className="size-4" aria-hidden />
                Guardar imagen
              </a>

              <a
                href="/barzucard/tarjeta/imprimir"
                className="inline-flex h-12 items-center justify-center gap-2 border border-line px-5 text-sm text-bone-dim transition-colors hover:border-crimson hover:text-bone"
              >
                <Printer className="size-4" aria-hidden />
                Imprimir la tarjeta
              </a>

              <ButtonLink href="/barzucard/promociones" variant="outline">
                Ver promociones
              </ButtonLink>

              <form action={logoutMember} className="contents">
                <button
                  type="submit"
                  className="inline-flex h-12 items-center justify-center gap-2 border border-line px-5 text-sm text-muted transition-colors hover:border-crimson hover:text-crimson-bright"
                >
                  <LogOut className="size-4" aria-hidden />
                  Cerrar sesión
                </button>
              </form>
            </div>

            {card.status !== "ACTIVE" && (
              <p className="mt-6 border border-crimson/50 bg-crimson/10 px-4 py-3 text-sm text-crimson-bright">
                Tu tarjeta está suspendida. Escríbenos para regularizarla.
              </p>
            )}
          </div>

          {/* Estado del socio */}
          <div className="print-hidden flex flex-col gap-8">
            <PaymentPanel
              status={card.paymentStatus}
              price={formatPrice(settings.cardPriceCents)}
              paymentInfo={settings.cardPaymentInfo}
              pickupInfo={settings.cardPickupInfo}
              reference={card.paymentReference}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="card-bz p-5">
                <p className="eyebrow text-muted">Beneficios usados</p>
                <p className="mt-2 font-display text-2xl text-bone">
                  {card.redemptions.length}
                </p>
              </div>

              <div className="card-bz p-5">
                <p className="eyebrow text-muted">Estado</p>
                <p className="mt-2 font-display text-2xl text-bone">
                  {card.status === "ACTIVE" ? "Activa" : "Suspendida"}
                </p>
              </div>
            </div>

            {/* Historial */}
            <div>
              <h2 className="font-display text-xl text-bone">
                Tus últimos canjes
              </h2>

              {card.redemptions.length === 0 ? (
                <p className="card-bz mt-4 p-6 text-sm text-muted">
                  Todavía no canjeaste ningún beneficio. Muestra tu QR en la
                  barra para estrenar la tarjeta.
                </p>
              ) : (
                <ul className="mt-4 flex flex-col gap-2">
                  {card.redemptions.map((redemption) => (
                    <li
                      key={redemption.id}
                      className="card-bz flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-bone">
                          {redemption.promotion.title}
                        </p>
                        <p className="text-xs text-muted-dark">
                          {formatDateTime(redemption.redeemedAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {redemption.discountCents > 0 && (
                          <span className="text-xs text-emerald-300">
                            −{formatPrice(redemption.discountCents)}
                          </span>
                        )}
                        <Badge tone="muted">{redemption.receiptCode}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* Promociones disponibles para este socio */}
      <Section className="print-hidden container-bz border-t border-line">
        <SectionHeading
          eyebrow="Disponibles para ti"
          title={
            available.length > 0
              ? "Beneficios que puedes canjear hoy"
              : "Sin beneficios disponibles ahora"
          }
          lead={
            available.length > 0
              ? "Elige el que quieras usar: te generamos un QR de ese descuento para mostrar en la barra."
              : "Vuelve a mirar más adelante: las promociones cambian seguido."
          }
        />

        {available.length > 0 && (
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((promotion, index) => (
              <Reveal key={promotion.id} delay={index * 70} className="h-full">
                <PromotionPicker promotion={promotion} />
              </Reveal>
            ))}
          </div>
        )}

        {available.length === 0 && promotions.length > 0 && (
          <div className="mt-8">
            <ButtonLink href="/barzucard/promociones" variant="outline">
              <Sparkles className="size-4" aria-hidden />
              Ver todas las promociones
            </ButtonLink>
          </div>
        )}
      </Section>
    </>
  );
}
