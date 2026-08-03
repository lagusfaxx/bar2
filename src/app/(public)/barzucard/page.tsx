import { Gift, QrCode, Sparkles, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";

import { PromotionCard } from "@/components/barzucard/promotion-card";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Reveal } from "@/components/ui/reveal";
import { Section, SectionHeading } from "@/components/ui/section";
import { getMemberSession } from "@/lib/auth";
import { getActivePromotions, getSettings } from "@/lib/content";
import { absoluteUrl } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const description =
    settings.loyaltyDescription ??
    `Súmate a ${settings.loyaltyTitle}, el programa de beneficios de ${settings.barName}.`;

  return {
    title: settings.loyaltyTitle,
    description,
    alternates: { canonical: absoluteUrl("/barzucard") },
    openGraph: {
      title: `${settings.loyaltyTitle} · ${settings.barName}`,
      description,
      url: absoluteUrl("/barzucard"),
    },
  };
}

const STEPS = [
  {
    icon: Sparkles,
    title: "Regístrate",
    text: "Crea tu cuenta en un minuto con tu nombre y tu email. Es gratis y no tiene costo de mantenimiento.",
  },
  {
    icon: QrCode,
    title: "Recibe tu tarjeta",
    text: "Te emitimos una BarzuCard con número único y código QR. La guardas en el celular sin costo, y si la quieres impresa la pides en el local.",
  },
  {
    icon: Gift,
    title: "Canjea beneficios",
    text: "Muestra el QR en la barra y el equipo valida la promoción al instante. Sin cupones ni papeles.",
  },
  {
    icon: TrendingUp,
    title: "Sube de nivel",
    text: "Cada canje suma puntos. Al acumularlos pasas a Plata y Oro, con beneficios exclusivos.",
  },
];

export default async function BarzuCardPage() {
  const [settings, promotions, session] = await Promise.all([
    getSettings(),
    getActivePromotions(),
    getMemberSession(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Programa de fidelización"
        title={
          <>
            <span className="font-western text-crimson">Barzu</span>Card
          </>
        }
        lead={settings.loyaltyDescription}
        image="/demo/promo-1.jpg"
      >
        <div className="flex flex-wrap gap-4">
          {session ? (
            <ButtonLink href="/barzucard/tarjeta" size="lg">
              <QrCode className="size-4" aria-hidden />
              Ver mi tarjeta
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/barzucard/registro" size="lg">
                <Sparkles className="size-4" aria-hidden />
                Pedir mi BarzuCard
              </ButtonLink>
              <ButtonLink href="/barzucard/ingresar" size="lg" variant="outline">
                Ya tengo cuenta
              </ButtonLink>
            </>
          )}
        </div>
      </PageHeader>

      {/* Cómo funciona */}
      <Section className="container-bz">
        <SectionHeading
          eyebrow="Cómo funciona"
          title="Cuatro pasos y listo"
          align="center"
        />

        <div className="mt-14 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <Reveal key={step.title} delay={index * 80}>
              <article className="group h-full bg-ink p-7 transition-colors duration-500 hover:bg-surface">
                <div className="flex items-center gap-3">
                  <step.icon className="size-6 text-crimson" aria-hidden />
                  <span className="font-display text-sm text-muted-dark">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-lg text-bone">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {step.text}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Niveles */}
      <Section className="border-y border-line bg-ink-soft">
        <div className="container-bz">
          <SectionHeading
            eyebrow="Niveles"
            title="Cuanto más vienes, mejor"
            lead="Los puntos se acumulan con cada beneficio canjeado en el local."
            align="center"
          />

          <div className="mt-14 grid gap-6 sm:grid-cols-3">
            {[
              {
                tier: "Clásica",
                points: "Desde 0 puntos",
                perks: ["Acceso a todas las promociones generales", "Tarjeta con QR y número único"],
                accent: "border-line",
              },
              {
                tier: "Plata",
                points: "Desde 400 puntos",
                perks: ["Todo lo de Clásica", "Promociones exclusivas Plata", "Prioridad en reservas"],
                accent: "border-slate-300/40",
              },
              {
                tier: "Oro",
                points: "Desde 1200 puntos",
                perks: ["Todo lo de Plata", "Beneficios exclusivos Oro", "Invitaciones a shows privados"],
                accent: "border-gilt/50",
              },
            ].map((level, index) => (
              <Reveal key={level.tier} delay={index * 90}>
                <article className={`h-full border bg-ink p-7 ${level.accent}`}>
                  <p className="font-display text-2xl text-bone">{level.tier}</p>
                  <p className="mt-1 text-xs tracking-[0.16em] text-crimson-bright uppercase">
                    {level.points}
                  </p>
                  <ul className="mt-6 flex flex-col gap-3">
                    {level.perks.map((perk) => (
                      <li
                        key={perk}
                        className="flex items-start gap-2.5 text-sm text-muted"
                      >
                        <span className="mt-1.5 size-1.5 shrink-0 rotate-45 bg-crimson" />
                        {perk}
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      {/* Promociones vigentes */}
      <Section className="container-bz">
        <SectionHeading
          eyebrow="Beneficios"
          title="Promociones vigentes"
          lead="Estas son las promociones que puedes canjear ahora mismo presentando tu BarzuCard."
          action={
            <ButtonLink href="/barzucard/promociones" variant="outline">
              Ver todas
            </ButtonLink>
          }
        />

        {promotions.length > 0 ? (
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {promotions.slice(0, 6).map((promotion, index) => (
              <Reveal key={promotion.id} delay={index * 70}>
                <PromotionCard promotion={promotion} />
              </Reveal>
            ))}
          </div>
        ) : (
          <p className="card-bz mt-14 p-12 text-center text-muted">
            Estamos preparando las próximas promociones. Vuelve pronto.
          </p>
        )}
      </Section>

      {/* Cierre */}
      <Section className="relative overflow-hidden border-t border-line">
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-crimson/10 blur-[140px]"
        />

        <div className="container-bz grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="Es gratis"
              title="Tu BarzuCard te espera"
              lead="Regístrate hoy y empieza a acumular puntos desde tu próxima visita."
            />

            <Reveal delay={120} className="mt-9 flex flex-wrap gap-4">
              {session ? (
                <ButtonLink href="/barzucard/tarjeta" size="lg">
                  Ver mi tarjeta
                </ButtonLink>
              ) : (
                <ButtonLink href="/barzucard/registro" size="lg">
                  <Sparkles className="size-4" aria-hidden />
                  Crear mi cuenta
                </ButtonLink>
              )}
              <ButtonLink href="/legales" size="lg" variant="ghost">
                Ver términos
              </ButtonLink>
            </Reveal>
          </div>

          <Reveal delay={160} className="relative">
            <div className="relative aspect-16/10 overflow-hidden border border-line">
              <Image
                src="/demo/promo-2.jpg"
                alt=""
                fill
                sizes="(max-width: 1024px) 90vw, 45vw"
                className="object-cover"
              />
              <div className="scrim absolute inset-0" />
            </div>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
