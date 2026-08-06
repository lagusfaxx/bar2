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
    title: "Regístrate gratis",
    text: "Nombre, email y listo: menos de un minuto. No se paga nada, ni al entrar ni nunca.",
  },
  {
    icon: QrCode,
    title: "Tu QR queda activo al instante",
    text: "La tarjeta vive en tu teléfono desde el segundo en que te registras. Si la quieres de plástico, la pides en el local.",
  },
  {
    icon: Gift,
    title: "Muestra el QR al pedir",
    text: "No al pagar: al pedir. La garzona lo escanea en la mesa y el descuento entra en la cuenta ahí mismo.",
  },
  {
    icon: TrendingUp,
    title: "Se descuenta solo",
    text: "El 2x1 o el porcentaje se aplican sobre lo que pediste, sin calcular nada y sin discutir con nadie.",
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

      {/* Que se lleva el socio */}
      <Section className="border-y border-line bg-ink-soft">
        <div className="container-bz">
          <SectionHeading
            eyebrow="Sin letra chica"
            title="Cómo funciona de verdad"
            lead="Un programa sirve si el beneficio llega a la cuenta sin fricción. Este funciona así."
            align="center"
          />

          <div className="mt-14 grid gap-6 sm:grid-cols-3">
            {[
              {
                title: "Gratis, siempre",
                text: "Registrarse no cuesta nada y la tarjeta no vence. La versión de plástico es opcional: se paga solo si la quieres tener en la mano.",
              },
              {
                title: "El descuento entra en la mesa",
                text: "La garzona escanea tu QR, toca el beneficio y la cuenta baja al instante. Nada de comprobantes que después nadie sabe dónde aplicar.",
              },
              {
                title: "Sabes qué te toca",
                text: "Cada promoción dice sobre qué producto aplica y cuántas veces puedes usarla. Lo mismo que ve el local en su sistema.",
              },
            ].map((item, index) => (
              <Reveal key={item.title} delay={index * 90}>
                <article className="h-full border border-line bg-ink p-7">
                  <p className="font-display text-xl text-bone">{item.title}</p>
                  <p className="mt-4 text-sm leading-relaxed text-muted">
                    {item.text}
                  </p>
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
          lead="Estas son las promociones que la garzona puede aplicarte hoy en la mesa, mostrando tu QR."
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
          className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full [background:radial-gradient(circle_closest-side,rgb(180_17_27/0.10),transparent)]"
        />

        <div className="container-bz grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="Es gratis"
              title="Tu BarzuCard te espera"
              lead="Te registras en un minuto y el QR queda activo para tu próxima visita. Sin costo y sin letra chica."
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
