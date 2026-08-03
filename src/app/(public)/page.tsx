import { ArrowRight, MapPin, Sparkles, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { EventCard } from "@/components/events/event-card";
import { Hero } from "@/components/site/hero";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { Badge, Section, SectionHeading } from "@/components/ui/section";
import {
  getFeaturedGallery,
  getFeaturedProducts,
  getSettings,
  getUpcomingEvents,
} from "@/lib/content";
import { formatPrice } from "@/lib/format";

/** Cintillo de fabrica, editable desde Ajustes → Secciones del inicio. */
const DEFAULT_MARQUEE = [
  "Música en vivo",
  "Tributos",
  "DJ sets",
  "Coctelería de autor",
  "Cocina de bar",
  "Karaoke",
  "After office",
].join("\n");

export default async function HomePage() {
  const [settings, upcoming, featuredProducts, gallery] = await Promise.all([
    getSettings(),
    getUpcomingEvents(7),
    getFeaturedProducts(4),
    getFeaturedGallery(6),
  ]);

  const [nextEvent, ...restEvents] = upcoming;

  // El cintillo admite una palabra por linea; si esta vacio usamos las de fabrica.
  const marqueeWords = (settings.marqueeText ?? DEFAULT_MARQUEE)
    .split(/[\n,]/)
    .map((word) => word.trim())
    .filter(Boolean);

  return (
    <>
      <Hero settings={settings} nextEvent={nextEvent ?? null} />

      {/* Cintillo: refuerza el caracter del local sin ocupar una seccion entera.
          Las palabras se cargan desde el panel (Ajustes → Secciones del inicio). */}
      {marqueeWords.length > 0 && (
        <div className="grain relative overflow-hidden border-y border-line bg-ink-soft py-4">
          <div className="flex w-max animate-marquee gap-10 whitespace-nowrap will-change-transform">
            {Array.from({ length: 2 }).map((_, group) => (
              <div key={group} className="flex gap-10" aria-hidden={group === 1}>
                {marqueeWords.map((word, index) => (
                  <span
                    key={`${word}-${index}`}
                    className="flex items-center gap-10 font-display text-lg text-bone-dim italic sm:text-xl"
                  >
                    {word}
                    <span className="size-1.5 rotate-45 bg-crimson" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cartelera */}
      <Section id="cartelera" className="container-bz">
        <SectionHeading
          eyebrow={settings.homeEventsEyebrow ?? "Cartelera"}
          title={
            settings.homeEventsTitle ?? (
              <>
                Lo que se viene en{" "}
                <span className="font-western text-crimson">{settings.barName}</span>
              </>
            )
          }
          lead={
            settings.homeEventsLead ??
            "Tributos, bandas en vivo y noches de DJ. La programación se actualiza todas las semanas."
          }
          action={
            <ButtonLink href="/eventos" variant="outline">
              Ver cartelera completa
              <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
          }
        />

        {upcoming.length > 0 ? (
          // En el telefono los afiches se deslizan en horizontal: seis carteles
          // apilados empujaban el resto del home fuera de la vista.
          <div className="no-scrollbar -mx-5 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:mt-14 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
            {upcoming.slice(0, 6).map((event, index) => (
              <Reveal
                key={event.id}
                delay={index * 70}
                fade
                className="w-[70%] shrink-0 snap-start sm:w-auto"
              >
                <EventCard event={event} priority={index < 3} />
              </Reveal>
            ))}
          </div>
        ) : (
          <p className="card-bz mt-14 p-12 text-center text-muted">
            Estamos armando la próxima cartelera. Vuelve pronto.
          </p>
        )}

        {restEvents.length > 5 && (
          <Reveal className="mt-10 flex justify-center">
            <ButtonLink href="/eventos" size="lg">
              Ver todos los eventos
              <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
          </Reveal>
        )}
      </Section>

      {/* BarzuCard */}
      {settings.loyaltyEnabled && (
        <Section className="relative overflow-hidden border-y border-line">
          <div
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-crimson/10 blur-[140px]"
          />

          <div className="container-bz grid items-center gap-14 lg:grid-cols-[1fr_auto]">
            <div>
              <SectionHeading
                eyebrow={settings.loyaltyTitle}
                title={
                  settings.homeLoyaltyTitle ?? (
                    <>
                      Tu tarjeta de{" "}
                      <span className="text-ember">beneficios</span> en{" "}
                      {settings.barName}
                    </>
                  )
                }
                lead={settings.loyaltyDescription}
              />

              <Reveal delay={140} className="mt-10 flex flex-wrap gap-4">
                <ButtonLink href="/barzucard/registro" size="lg">
                  <Sparkles className="size-4" aria-hidden />
                  Pedir mi {settings.loyaltyTitle}
                </ButtonLink>
                <ButtonLink
                  href="/barzucard/promociones"
                  size="lg"
                  variant="outline"
                >
                  Ver promociones
                </ButtonLink>
              </Reveal>
            </div>

            {/* Maqueta de la tarjeta, no una foto: siempre nitida y editable. */}
            <Reveal delay={200} className="mx-auto w-full max-w-sm">
              <div className="relative aspect-[1.586/1] w-full rotate-[-4deg] overflow-hidden rounded-xl border border-gilt/30 bg-gradient-to-br from-surface-2 via-ink to-crimson-deep/40 p-6 shadow-lift transition-transform duration-700 hover:rotate-0">
                <div className="flex h-full flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <span className="font-western text-xl text-crimson">
                      BAR<span className="text-bone">Z</span>UO
                    </span>
                    <Star className="size-5 text-gilt" aria-hidden />
                  </div>

                  <div>
                    <p className="font-mono text-sm tracking-[0.2em] text-bone-dim">
                      5210 •••• •••• 0001
                    </p>
                    <p className="eyebrow mt-2 text-gilt-soft">
                      {settings.loyaltyTitle} · Clásica
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </Section>
      )}

      {/* Nosotros */}
      <Section className="relative overflow-hidden border-y border-line bg-ink-soft">
        <div className="container-bz grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <Reveal className="relative">
            <div className="relative aspect-4/5 overflow-hidden">
              <Image
                src={settings.aboutImageUrl ?? "/demo/about-1.jpg"}
                alt={`Interior de ${settings.barName}`}
                fill
                sizes="(max-width: 1024px) 90vw, 45vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
            </div>

            {/* Segunda imagen superpuesta: rompe la simetria del bloque. */}
            <div className="absolute -right-4 -bottom-10 hidden aspect-4/3 w-2/5 overflow-hidden border-4 border-ink shadow-lift sm:block">
              <Image
                src={settings.aboutSecondaryImageUrl ?? "/demo/about-2.jpg"}
                alt=""
                fill
                sizes="25vw"
                className="object-cover"
              />
            </div>
          </Reveal>

          <div>
            <SectionHeading
              eyebrow="Nosotros"
              title={settings.aboutTitle ?? "Nuestra historia"}
              lead={settings.aboutLead}
            />

            {settings.aboutBody && (
              <Reveal delay={100}>
                <div className="mt-6 flex flex-col gap-4 text-sm leading-relaxed text-muted sm:text-[0.95rem]">
                  {settings.aboutBody
                    .split(/\n{2,}/)
                    .slice(0, 2)
                    .map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                </div>
              </Reveal>
            )}

            <Reveal delay={180} className="mt-10 flex flex-wrap gap-4">
              <ButtonLink href="/nosotros" variant="outline">
                Conocer {settings.barName}
              </ButtonLink>
              <ButtonLink href="/ubicacion" variant="ghost">
                <MapPin className="size-4" aria-hidden />
                Cómo llegar
              </ButtonLink>
            </Reveal>
          </div>
        </div>
      </Section>

      {/* Carta destacada */}
      {featuredProducts.length > 0 && (
        <Section className="container-bz">
          <SectionHeading
            eyebrow={settings.homeMenuEyebrow ?? "La carta"}
            title={settings.homeMenuTitle ?? "Para acompañar la noche"}
            lead={
              settings.homeMenuLead ??
              "Cocina para compartir, coctelería clásica y las promos de la barra."
            }
            action={
              <ButtonLink href="/carta" variant="outline">
                Ver la carta completa
                <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
            }
          />

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featuredProducts.map((product, index) => (
              <Reveal key={product.id} delay={index * 70}>
                <article className="card-bz hover-ember group h-full">
                  <div className="relative aspect-square overflow-hidden bg-surface-2">
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        sizes="(max-width: 640px) 88vw, (max-width: 1024px) 45vw, 23vw"
                        className="object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-crimson-deep/30 to-ink" />
                    )}
                    <div className="scrim absolute inset-0 opacity-80" />
                    <Badge tone="crimson" className="absolute top-3 left-3">
                      {product.category.name}
                    </Badge>
                  </div>

                  <div className="flex flex-col gap-2 p-5">
                    <h3 className="font-display text-lg leading-tight text-bone">
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="line-clamp-2 text-xs leading-relaxed text-muted">
                        {product.description}
                      </p>
                    )}
                    <p className="mt-1 font-display text-lg text-crimson-bright">
                      {formatPrice(product.priceCents)}
                    </p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      {/* Galería */}
      {gallery.length > 0 && (
        <Section className="container-bz">
          <SectionHeading
            eyebrow={settings.homeGalleryEyebrow ?? "Galería"}
            title={settings.homeGalleryTitle ?? "Noches que quedan"}
            lead={
              settings.homeGalleryLead ??
              `Un vistazo a lo que se vive cada fin de semana en ${settings.barName}.`
            }
            action={
              <ButtonLink href="/galeria" variant="outline">
                Ver la galería
                <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
            }
          />

          <div className="mt-14 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {gallery.slice(0, 6).map((image, index) => (
              <Reveal
                key={image.id}
                delay={index * 60}
                className={
                  // Dos piezas mas grandes rompen la grilla y dan ritmo.
                  index === 0 || index === 3
                    ? "col-span-2 row-span-2"
                    : undefined
                }
              >
                <Link
                  href="/galeria"
                  className="group relative block aspect-square overflow-hidden"
                >
                  <Image
                    src={image.url}
                    alt={image.alt}
                    fill
                    sizes="(max-width: 640px) 45vw, 25vw"
                    className="object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-ink/35 transition-opacity duration-500 group-hover:opacity-0" />
                </Link>
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      {/* Ubicación */}
      <Section className="border-t border-line bg-ink-soft">
        <div className="container-bz grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow={settings.homeLocationEyebrow ?? "Ubicación"}
              title={settings.homeLocationTitle ?? "Te esperamos"}
              lead={`${settings.address} — ${settings.addressCity}`}
            />

            <Reveal delay={120} className="mt-8 flex flex-wrap gap-4">
              <ButtonLink href="/ubicacion">
                <MapPin className="size-4" aria-hidden />
                Ver el mapa
              </ButtonLink>
              <ButtonLink href="/contacto" variant="outline">
                Reservar una mesa
              </ButtonLink>
            </Reveal>
          </div>

          <Reveal delay={160} className="card-bz overflow-hidden">
            <div className="relative aspect-16/10">
              <Image
                src={settings.aboutSecondaryImageUrl ?? "/demo/about-2.jpg"}
                alt=""
                fill
                sizes="(max-width: 1024px) 90vw, 45vw"
                className="object-cover"
              />
              <div className="scrim absolute inset-0" />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <p className="font-display text-xl text-bone">
                  {settings.barName}
                </p>
                <p className="mt-1 text-sm text-muted">{settings.address}</p>
              </div>
            </div>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
