import type { Metadata } from "next";

import { PromotionCard } from "@/components/barzucard/promotion-card";
import { PromotionPicker } from "@/components/barzucard/promotion-picker";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Reveal } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";
import { getMemberSession } from "@/lib/auth";
import { checkEligibility } from "@/lib/barzucard";
import { getActivePromotions, getSettings } from "@/lib/content";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const description = `Todas las promociones vigentes del programa ${settings.loyaltyTitle} de ${settings.barName}.`;

  return {
    title: "Promociones BarzuCard",
    description,
    alternates: { canonical: absoluteUrl("/barzucard/promociones") },
    openGraph: {
      title: `Promociones · ${settings.barName}`,
      description,
      url: absoluteUrl("/barzucard/promociones"),
    },
  };
}

export default async function PromocionesPage() {
  const [promotions, settings, session] = await Promise.all([
    getActivePromotions(),
    getSettings(),
    getMemberSession(),
  ]);

  /**
   * Para un socio con sesión abierta cada promoción trae su botón: puede pedir
   * el cupón acá mismo, sin pasar antes por la tarjeta.
   */
  const card = session
    ? await prisma.barzuCard.findUnique({
        where: { memberId: session.memberId },
        select: { id: true, status: true },
      })
    : null;

  const usageByPromotion = new Map<string, number>();

  if (card) {
    const usage = await prisma.redemption.groupBy({
      by: ["promotionId"],
      where: { cardId: card.id, voidedAt: null },
      _count: { promotionId: true },
    });

    for (const entry of usage) {
      usageByPromotion.set(entry.promotionId, entry._count.promotionId);
    }
  }

  const canRedeem = (promotionId: string) => {
    if (!card) return false;
    const promotion = promotions.find((item) => item.id === promotionId);
    if (!promotion) return false;

    return checkEligibility({
      promotion,
      card,
      redemptionsForThisPromotion: usageByPromotion.get(promotionId) ?? 0,
    }).ok;
  };

  return (
    <>
      <PageHeader
        eyebrow={settings.loyaltyTitle}
        title="Promociones vigentes"
        lead="Elige el beneficio que quieras usar desde tu BarzuCard: te damos un QR de ese descuento y el personal de sala solo lo confirma."
        image="/demo/promo-5.jpg"
      >
        <ButtonLink href="/barzucard/tarjeta" size="lg">
          Ver mi tarjeta
        </ButtonLink>
      </PageHeader>

      <Section className="container-bz">
        {promotions.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {promotions.map((promotion, index) => (
              <Reveal
                key={promotion.id}
                delay={Math.min(index, 8) * 70}
                className="h-full"
              >
                {canRedeem(promotion.id) ? (
                  <PromotionPicker promotion={promotion} />
                ) : (
                  <PromotionCard promotion={promotion} />
                )}
              </Reveal>
            ))}
          </div>
        ) : (
          <p className="card-bz p-12 text-center text-muted">
            No hay promociones activas en este momento. Vuelve pronto.
          </p>
        )}

        {settings.loyaltyTerms && (
          <div className="mt-16 border-t border-line pt-8">
            <h2 className="eyebrow mb-4 text-bone">Condiciones generales</h2>
            <div className="flex max-w-3xl flex-col gap-3 text-xs leading-relaxed text-muted-dark">
              {settings.loyaltyTerms.split(/\n{2,}/).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>
        )}
      </Section>
    </>
  );
}
