import { ArrowRight, CalendarDays, ChevronDown } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { HeroBackground } from "@/components/site/hero-background";
import { ButtonLink } from "@/components/ui/button";
import type { EventCard as EventCardData } from "@/lib/content";
import { dateParts, EVENT_CATEGORY_LABELS } from "@/lib/format";

type HeroProps = {
  settings: {
    barName: string;
    tagline: string;
    logoUrl: string | null;
    heroTitle: string;
    heroEyebrow: string | null;
    heroSubtitle: string | null;
    heroImageUrl: string | null;
    heroImageMobileUrl: string | null;
    heroVideoUrl: string | null;
    heroVideoPosterUrl: string | null;
    heroCtaLabel: string | null;
    heroCtaHref: string | null;
    heroCtaSecondaryLabel: string | null;
    heroCtaSecondaryHref: string | null;
  };
  nextEvent?: EventCardData | null;
};

/** Portada apaisada de demostracion y su variante vertical. */
const DEMO_HERO = "/demo/hero.jpg";
const DEMO_HERO_PORTRAIT = "/demo/hero-mobile.jpg";

export function Hero({ settings, nextEvent }: HeroProps) {
  const background = settings.heroImageUrl ?? DEMO_HERO;

  // Variante vertical para el telefono. Si el local no subio una, se recurre a
  // la de demostracion solo cuando tampoco cambio la horizontal; con una foto
  // propia sin vertical se recorta la horizontal, que es lo unico que hay.
  const backgroundPortrait =
    settings.heroImageMobileUrl ??
    (background === DEMO_HERO ? DEMO_HERO_PORTRAIT : null);

  return (
    <section className="relative isolate flex min-h-[100svh] flex-col justify-between overflow-hidden">
      {/* Fondo: imagen siempre; el video solo donde tiene sentido cargarlo. */}
      <div className="absolute inset-0 -z-10">
        <HeroBackground
          background={background}
          backgroundPortrait={backgroundPortrait}
          videoUrl={settings.heroVideoUrl}
          videoPosterUrl={settings.heroVideoPosterUrl}
        />

        {/*
          Capas de lectura: dan contraste al texto sin apagar el fondo.

          Se mantienen fuertes arriba y abajo —donde van el logotipo y el
          proximo show— y se aligeran en el centro, que es donde se ve la foto.
          Antes el velo plano dejaba negra cualquier imagen de bar, que por
          definicion es una foto oscura.
        */}
        <div className="absolute inset-0 bg-gradient-to-b from-ink/75 via-ink/10 to-ink" />
        <div
          className="absolute inset-0"
          style={{
            background:
              // Viñeta suave. Con 0.7 en los bordes, sumada al degradado
              // vertical, no quedaba foto que sobreviviera.
              "radial-gradient(80% 65% at 50% 45%, transparent 45%, rgba(8,7,10,0.45) 100%)",
          }}
        />
      </div>

      {/*
        Brasas: dos halos que respiran muy lentamente.

        El difuminado esta pintado en el propio degradado y no con `blur`. Un
        `blur-[120px]` sobre un circulo de 32rem obliga al navegador a
        desenfocar una superficie enorme, y en un telefono ese trabajo cae
        justo encima del primer dibujado de la portada. Un
        `radial-gradient` da el mismo halo sin pasar por el filtro.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 -z-10 size-[32rem] animate-ember rounded-full [background:radial-gradient(circle_closest-side,rgb(180_17_27/0.18),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 bottom-0 -z-10 size-[30rem] animate-ember rounded-full [animation-delay:2.5s] [background:radial-gradient(circle_closest-side,rgb(107_10_17/0.25),transparent)]"
      />

      <div className="container-bz flex flex-1 flex-col items-center justify-center py-32 text-center sm:py-36">
        {settings.heroEyebrow && (
          <p className="animate-fade-in font-western text-[0.7rem] tracking-[0.4em] text-crimson-bright sm:text-xs">
            {settings.heroEyebrow}
          </p>
        )}

        <div className="mt-8 animate-reveal">
          <Logo
            src={settings.logoUrl}
            name={settings.heroTitle || settings.barName}
            tagline={settings.tagline}
            variant="stacked"
            priority
            className="text-[clamp(3rem,13vw,8rem)]"
          />
        </div>

        {settings.heroSubtitle && (
          <p
            className="mt-9 max-w-2xl animate-reveal text-balance text-base leading-relaxed text-bone-dim sm:text-lg"
            style={{ animationDelay: "120ms" }}
          >
            {settings.heroSubtitle}
          </p>
        )}

        <div
          className="mt-11 flex w-full animate-reveal flex-col items-center gap-3 sm:w-auto sm:flex-row sm:gap-4"
          style={{ animationDelay: "220ms" }}
        >
          {settings.heroCtaLabel && settings.heroCtaHref && (
            <ButtonLink
              href={settings.heroCtaHref}
              size="lg"
              className="w-full sm:w-auto"
            >
              <CalendarDays className="size-4" aria-hidden />
              {settings.heroCtaLabel}
            </ButtonLink>
          )}

          {settings.heroCtaSecondaryLabel && settings.heroCtaSecondaryHref && (
            <ButtonLink
              href={settings.heroCtaSecondaryHref}
              size="lg"
              variant="outline"
              className="w-full sm:w-auto"
            >
              {settings.heroCtaSecondaryLabel}
              <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
          )}
        </div>
      </div>

      {/* Pie del hero: proximo show y señal de scroll. */}
      {/*
        En telefono la franja va opaca en vez de translucida. `backdrop-blur`
        obliga al navegador a desenfocar lo que hay debajo en cada cuadro del
        scroll, y aca debajo hay una foto a pantalla completa. En pantalla
        grande, donde eso sobra de potencia, se conserva el vidrio.
      */}
      <div className="relative z-10 border-t border-bone/10 bg-ink/85 sm:bg-ink/45 sm:backdrop-blur-md">
        <div className="container-bz flex flex-col items-center gap-4 py-5 sm:flex-row sm:justify-between">
          {nextEvent ? (
            <Link
              href={`/eventos/${nextEvent.slug}`}
              className="group flex min-w-0 items-center gap-4 text-left"
            >
              <span className="eyebrow shrink-0 text-crimson-bright">
                Próximo
              </span>
              <span className="hidden h-8 w-px bg-line sm:block" />
              <span className="min-w-0">
                <span className="block truncate font-display text-base text-bone transition-colors group-hover:text-crimson-bright sm:text-lg">
                  {nextEvent.title}
                </span>
                <span className="block truncate text-xs text-muted">
                  {dateParts(nextEvent.startsAt).weekday}{" "}
                  {dateParts(nextEvent.startsAt).day}{" "}
                  {dateParts(nextEvent.startsAt).monthLong} ·{" "}
                  {dateParts(nextEvent.startsAt).time} h ·{" "}
                  {EVENT_CATEGORY_LABELS[nextEvent.category]}
                </span>
              </span>
              <ArrowRight
                className="size-4 shrink-0 text-muted transition-transform duration-500 group-hover:translate-x-1 group-hover:text-crimson-bright"
                aria-hidden
              />
            </Link>
          ) : (
            <p className="eyebrow text-muted">{settings.tagline}</p>
          )}

          <a
            href="#cartelera"
            aria-label="Ver la cartelera"
            className="hidden items-center gap-2 text-[0.65rem] tracking-[0.2em] text-muted uppercase transition-colors hover:text-bone sm:flex"
          >
            Descubre BARZUO
            <ChevronDown className="size-4 animate-bounce" aria-hidden />
          </a>
        </div>
      </div>
    </section>
  );
}
