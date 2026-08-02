import { LogOut, Printer, Sparkles, Star } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { logoutMember } from "@/app/actions/auth";
import { CardVisual } from "@/components/barzucard/card-visual";
import { PromotionCard } from "@/components/barzucard/promotion-card";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Reveal } from "@/components/ui/reveal";
import { Section, SectionHeading, Badge } from "@/components/ui/section";
import { getMemberSession } from "@/lib/auth";
import { checkEligibility } from "@/lib/barzucard";
import { getActivePromotions, getSettings } from "@/lib/content";
import { formatDateTime, TIER_LABELS } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { cardQrDataUrl } from "@/lib/qr";

export const metadata: Metadata = {
  title: "Mi BarzuCard",
  // Es un área privada: no debe indexarse.
  robots: { index: false, follow: false },
};

/** Puntos necesarios para el siguiente nivel. */
function nextTierProgress(points: number) {
  if (points >= 1200) return null;
  const target = points >= 400 ? 1200 : 400;
  const floor = points >= 400 ? 400 : 0;

  return {
    target,
    label: points >= 400 ? "Oro" : "Plata",
    missing: target - points,
    percent: Math.round(((points - floor) / (target - floor)) * 100),
  };
}

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
  const qrDataUrl = await cardQrDataUrl(card.qrToken);
  const progress = nextTierProgress(card.points);

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
        card: { tier: card.tier, status: card.status, points: card.points },
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
            ? "¡Bienvenido al programa! Esta es tu tarjeta: mostrá el QR en la barra para canjear beneficios."
            : "Mostrá este QR en la barra para canjear tus beneficios."
        }
      />

      <Section className="container-bz">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-16">
          {/* Tarjeta */}
          <div>
            <Reveal>
              <CardVisual
                cardNumber={card.cardNumber}
                holder={member.fullName}
                tier={card.tier}
                points={card.points}
                qrDataUrl={qrDataUrl}
                issuedAt={card.issuedAt}
                status={card.status}
              />
            </Reveal>

            <div className="print-hidden mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/barzucard/promociones" size="sm" variant="outline">
                Ver promociones
              </ButtonLink>

              <a
                href="/barzucard/tarjeta/imprimir"
                className="inline-flex h-9 items-center gap-2 border border-line px-4 text-[0.65rem] font-medium tracking-[0.18em] text-bone-dim uppercase transition-colors hover:border-crimson hover:text-bone"
              >
                <Printer className="size-3.5" aria-hidden />
                Versión para imprimir
              </a>

              <form action={logoutMember}>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-2 border border-line px-4 text-[0.65rem] font-medium tracking-[0.18em] text-muted uppercase transition-colors hover:border-crimson hover:text-crimson-bright"
                >
                  <LogOut className="size-3.5" aria-hidden />
                  Salir
                </button>
              </form>
            </div>

            {card.status !== "ACTIVE" && (
              <p className="mt-6 border border-crimson/50 bg-crimson/10 px-4 py-3 text-sm text-crimson-bright">
                Tu tarjeta está suspendida. Escribinos para regularizarla.
              </p>
            )}
          </div>

          {/* Estado del socio */}
          <div className="print-hidden flex flex-col gap-8">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="card-bz p-5">
                <p className="eyebrow text-muted">Nivel</p>
                <p className="mt-2 font-display text-2xl text-bone">
                  {TIER_LABELS[card.tier]}
                </p>
              </div>

              <div className="card-bz p-5">
                <p className="eyebrow text-muted">Puntos</p>
                <p className="mt-2 font-display text-2xl text-gilt-soft">
                  {card.points}
                </p>
              </div>

              <div className="card-bz p-5">
                <p className="eyebrow text-muted">Canjes</p>
                <p className="mt-2 font-display text-2xl text-bone">
                  {card.redemptions.length}
                </p>
              </div>
            </div>

            {progress && (
              <div className="card-bz p-6">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-sm text-bone-dim">
                    Te faltan{" "}
                    <span className="text-crimson-bright">
                      {progress.missing} puntos
                    </span>{" "}
                    para el nivel {progress.label}
                  </p>
                  <p className="text-xs text-muted-dark tabular-nums">
                    {card.points} / {progress.target}
                  </p>
                </div>

                <div
                  className="mt-4 h-1.5 w-full overflow-hidden bg-surface-2"
                  role="progressbar"
                  aria-valuenow={progress.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progreso hacia el nivel ${progress.label}`}
                >
                  <div
                    className="h-full bg-gradient-to-r from-crimson to-gilt transition-[width] duration-1000"
                    style={{ width: `${Math.max(3, progress.percent)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Historial */}
            <div>
              <h2 className="font-display text-xl text-bone">
                Tus últimos canjes
              </h2>

              {card.redemptions.length === 0 ? (
                <p className="card-bz mt-4 p-6 text-sm text-muted">
                  Todavía no canjeaste ningún beneficio. Mostrá tu QR en la
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
                        {redemption.pointsEarned > 0 && (
                          <span className="flex items-center gap-1 text-xs text-gilt-soft">
                            <Star className="size-3" aria-hidden />+
                            {redemption.pointsEarned}
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
          eyebrow="Disponibles para vos"
          title={
            available.length > 0
              ? "Beneficios que podés canjear hoy"
              : "Sin beneficios disponibles ahora"
          }
          lead={
            available.length > 0
              ? `Mostrá el QR de tu ${settings.loyaltyTitle} en la barra.`
              : "Volvé a mirar más adelante: las promociones cambian seguido."
          }
        />

        {available.length > 0 && (
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((promotion, index) => (
              <Reveal key={promotion.id} delay={index * 70}>
                <PromotionCard promotion={promotion} />
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
