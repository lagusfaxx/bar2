import type { Metadata } from "next";

import { PromotionCard } from "@/components/barzucard/promotion-card";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Reveal } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";
import { getActivePromotions, getSettings } from "@/lib/content";
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
  const [promotions, settings] = await Promise.all([
    getActivePromotions(),
    getSettings(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={settings.loyaltyTitle}
        title="Promociones vigentes"
        lead="Presentá el QR de tu BarzuCard en la barra y el equipo valida el beneficio al instante."
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
              <Reveal key={promotion.id} delay={Math.min(index, 8) * 70}>
                <PromotionCard promotion={promotion} />
              </Reveal>
            ))}
          </div>
        ) : (
          <p className="card-bz p-12 text-center text-muted">
            No hay promociones activas en este momento. Volvé pronto.
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

/** Regeneracion periodica; el CMS ademas invalida al guardar. */
export const revalidate = 300;
