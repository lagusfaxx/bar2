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

  // Solo la portada que viene con el proyecto tiene variante vertical; una
  // imagen subida desde el CMS se usa tal cual, reencuadrada por CSS.
  const backgroundPortrait =
    background === DEMO_HERO ? DEMO_HERO_PORTRAIT : null;

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

        {/* Capas de lectura: dan contraste al texto sin apagar el fondo. */}
        <div className="absolute inset-0 bg-ink/15" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/80 via-transparent to-ink" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(75% 60% at 50% 45%, transparent 30%, rgba(8,7,10,0.7) 100%)",
          }}
        />
      </div>

      {/* Brasas: dos halos que respiran muy lentamente. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 -z-10 size-[32rem] rounded-full bg-crimson/18 blur-[120px] animate-ember"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 bottom-0 -z-10 size-[30rem] rounded-full bg-crimson-deep/25 blur-[130px] animate-ember [animation-delay:2.5s]"
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
      <div className="relative z-10 border-t border-bone/10 bg-ink/45 backdrop-blur-md">
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
