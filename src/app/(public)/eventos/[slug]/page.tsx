import { CalendarDays, Clock, DoorOpen, Music2, Ticket, Users } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { EventCard } from "@/components/events/event-card";
import { RatingForm } from "@/components/events/rating-form";
import { ShareButtons } from "@/components/events/share-buttons";
import { Stars } from "@/components/events/stars";
import { ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { Badge, Section, SectionHeading } from "@/components/ui/section";
import {
  getEventBySlug,
  getEventRatingSummary,
  getRelatedEvents,
  getSettings,
} from "@/lib/content";
import {
  dateParts,
  EVENT_CATEGORY_LABELS,
  formatDate,
  formatPrice,
  formatTime,
} from "@/lib/format";
import { absoluteUrl, truncate } from "@/lib/utils";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const [event, settings] = await Promise.all([
    getEventBySlug(slug),
    getSettings(),
  ]);

  if (!event) {
    return { title: "Evento no encontrado" };
  }

  const title = event.seoTitle || `${event.title}${event.artist ? ` — ${event.artist}` : ""}`;
  const description =
    event.seoDescription ||
    event.excerpt ||
    truncate(event.description ?? settings.seoDescription, 160);
  const image = event.ogImageUrl ?? event.posterUrl ?? event.coverUrl ?? settings.seoImageUrl;
  const url = absoluteUrl(`/eventos/${event.slug}`);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      images: image ? [{ url: image, alt: event.title }] : undefined,
      publishedTime: event.createdAt.toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function EventoPage({ params }: Params) {
  const { slug } = await params;
  const [event, settings] = await Promise.all([
    getEventBySlug(slug),
    getSettings(),
  ]);

  if (!event) notFound();

  const [related, ratingSummary] = await Promise.all([
    getRelatedEvents(event.id, event.category, 3),
    getEventRatingSummary(event.id),
  ]);

  const parts = dateParts(event.startsAt);
  const isPast = event.startsAt < new Date();
  const url = absoluteUrl(`/eventos/${event.slug}`);
  const poster = event.posterUrl ?? event.coverUrl;

  // Datos estructurados para que Google muestre el evento como tal.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MusicEvent",
    name: event.title,
    startDate: event.startsAt.toISOString(),
    endDate: event.endsAt?.toISOString(),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    description: event.excerpt ?? truncate(event.description ?? "", 300),
    image: poster ? [absoluteUrl(poster)] : undefined,
    url,
    performer: event.artist
      ? { "@type": "MusicGroup", name: event.artist }
      : undefined,
    location: {
      "@type": "Place",
      name: settings.barName,
      address: {
        "@type": "PostalAddress",
        streetAddress: settings.address,
        addressLocality: settings.addressCity,
        addressCountry: "CL",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: settings.latitude,
        longitude: settings.longitude,
      },
    },
    offers: {
      "@type": "Offer",
      price: event.isFree ? 0 : (event.priceCents ?? 0) / 100,
      priceCurrency: process.env.NEXT_PUBLIC_CURRENCY ?? "CLP",
      availability: "https://schema.org/InStock",
      url: event.ticketUrl ?? url,
      validFrom: event.createdAt.toISOString(),
    },
    aggregateRating:
      ratingSummary.count > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: ratingSummary.average.toFixed(1),
            reviewCount: ratingSummary.count,
          }
        : undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        // El JSON se genera en el servidor a partir de datos propios.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Cabecera del evento */}
      <header className="relative isolate overflow-hidden pt-28 pb-16 sm:pt-36 sm:pb-20">
        <div className="absolute inset-0 -z-10">
          {poster && (
            <Image
              src={poster}
              alt=""
              fill
              // Este fondo se muestra desenfocado, al 30% y detras de un
              // degradado: nadie distingue un pixel. Pedia el afiche a ancho
              // de pantalla completa, o sea una segunda copia grande de la
              // misma foto que ya se esta bajando nitida al lado. Con 64px
              // alcanza y sobra — el desenfoque hace el resto.
              sizes="64px"
              loading="eager"
              className="scale-110 object-cover opacity-30 blur-2xl"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-ink/85 via-ink/70 to-ink" />
        </div>

        <div className="container-bz grid gap-10 lg:grid-cols-[22rem_1fr] lg:gap-14">
          <Reveal className="mx-auto w-full max-w-sm lg:mx-0">
            <div className="relative aspect-5/7 overflow-hidden border border-line shadow-lift">
              {poster ? (
                <Image
                  src={poster}
                  alt={`Afiche de ${event.title}`}
                  fill
                  preload
                  sizes="(max-width: 1024px) 90vw, 22rem"
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(120%_80%_at_50%_0%,var(--color-crimson-deep),var(--color-ink))]">
                  <span className="font-western text-5xl text-crimson/40">BZ</span>
                </div>
              )}
            </div>
          </Reveal>

          <div className="flex flex-col justify-center">
            <Reveal>
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <Badge tone="crimson">
                  {EVENT_CATEGORY_LABELS[event.category] ?? event.category}
                </Badge>
                {event.featured && <Badge tone="gilt">Destacado</Badge>}
                {isPast && <Badge tone="muted">Ya realizado</Badge>}
              </div>

              <h1 className="text-[clamp(2rem,6vw,4rem)] leading-[1.03]">
                {event.title}
              </h1>

              {event.artist && (
                <p className="mt-4 flex items-center gap-2.5 font-display text-xl text-crimson-bright italic sm:text-2xl">
                  <Music2 className="size-5" aria-hidden />
                  {event.artist}
                </p>
              )}

              {event.excerpt && (
                <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
                  {event.excerpt}
                </p>
              )}

              {ratingSummary.count > 0 && (
                <div className="mt-6 flex items-center gap-3">
                  <Stars value={ratingSummary.average} />
                  <span className="text-sm text-muted">
                    {ratingSummary.average.toFixed(1)} · {ratingSummary.count}{" "}
                    {ratingSummary.count === 1 ? "opinión" : "opiniones"}
                  </span>
                </div>
              )}
            </Reveal>

            {/* Ficha rápida */}
            <Reveal delay={120}>
              <dl className="mt-9 grid grid-cols-2 gap-px overflow-hidden border border-line bg-line sm:grid-cols-4">
                <InfoCell
                  icon={<CalendarDays className="size-4" aria-hidden />}
                  label="Fecha"
                  value={
                    <span className="capitalize">
                      {parts.weekday} {parts.day}/{parts.monthNumeric}
                    </span>
                  }
                />
                <InfoCell
                  icon={<Clock className="size-4" aria-hidden />}
                  label="Show"
                  value={`${parts.time} h`}
                />
                {event.doorsAt && (
                  <InfoCell
                    icon={<DoorOpen className="size-4" aria-hidden />}
                    label="Puertas"
                    value={`${formatTime(event.doorsAt)} h`}
                  />
                )}
                <InfoCell
                  icon={<Ticket className="size-4" aria-hidden />}
                  label="Entrada"
                  value={
                    event.isFree ? (
                      <span className="text-emerald-300">Libre</span>
                    ) : (
                      formatPrice(event.priceCents)
                    )
                  }
                />
                {event.capacity && (
                  <InfoCell
                    icon={<Users className="size-4" aria-hidden />}
                    label="Capacidad"
                    value={`${event.capacity}`}
                  />
                )}
              </dl>
            </Reveal>

            <Reveal delay={200} className="mt-9 flex flex-wrap items-center gap-4">
              {!isPast && event.ticketUrl && (
                <ButtonAnchor
                  href={event.ticketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="lg"
                >
                  <Ticket className="size-4" aria-hidden />
                  Comprar entrada
                </ButtonAnchor>
              )}

              {!isPast && !event.ticketUrl && (
                <ButtonLink href="/contacto" size="lg">
                  Reservar mesa
                </ButtonLink>
              )}

              <ButtonLink href="/eventos" variant="outline" size="lg">
                Ver toda la cartelera
              </ButtonLink>
            </Reveal>

            <Reveal delay={260} className="mt-8">
              <ShareButtons
                url={url}
                title={`${event.title} en ${settings.barName}`}
                text={`${event.title}${event.artist ? ` — ${event.artist}` : ""} · ${formatDate(event.startsAt)} en ${settings.barName}`}
              />
            </Reveal>
          </div>
        </div>
      </header>

      {/* Descripción y datos del local */}
      <Section className="container-bz border-t border-line">
        <div className="grid gap-14 lg:grid-cols-[1fr_20rem]">
          <div>
            <SectionHeading eyebrow="El show" title="Sobre esta noche" />

            {event.description ? (
              <div className="mt-8 flex flex-col gap-5 text-[0.975rem] leading-relaxed text-bone-dim">
                {event.description.split(/\n{2,}/).map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            ) : (
              <p className="mt-8 text-muted">
                Pronto vamos a publicar más detalles de este evento.
              </p>
            )}
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="card-bz p-6">
              <h2 className="eyebrow mb-5 text-bone">Dónde</h2>
              <p className="font-display text-xl text-bone">{settings.barName}</p>
              <p className="mt-2 text-sm text-muted">{settings.address}</p>
              <p className="text-sm text-muted-dark">{settings.addressCity}</p>

              <div className="mt-6 flex flex-col gap-3">
                <ButtonAnchor
                  href={`https://www.google.com/maps/dir/?api=1&destination=${settings.latitude},${settings.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outline"
                  size="sm"
                >
                  Cómo llegar
                </ButtonAnchor>
                <ButtonLink href="/ubicacion" variant="ghost" size="sm">
                  Ver el mapa
                </ButtonLink>
              </div>

              {settings.reservationsNote && (
                <p className="mt-6 border-t border-line pt-5 text-xs leading-relaxed text-muted-dark">
                  {settings.reservationsNote}
                </p>
              )}
            </div>
          </aside>
        </div>
      </Section>

      {/* Galería del evento */}
      {event.gallery.length > 0 && (
        <Section className="container-bz border-t border-line">
          <SectionHeading
            eyebrow="Galería"
            title="Fotos de esta noche"
          />

          <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {event.gallery.map((image, index) => (
              <Reveal key={image.id} delay={index * 60}>
                <figure className="relative aspect-square overflow-hidden">
                  <Image
                    src={image.url}
                    alt={image.alt}
                    fill
                    sizes="(max-width: 640px) 45vw, 25vw"
                    className="object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-110"
                  />
                </figure>
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      {/* Calificaciones */}
      <Section className="border-t border-line bg-ink-soft">
        <div className="container-bz grid gap-14 lg:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="Opiniones"
              title={
                ratingSummary.count > 0
                  ? "Lo que dijo el público"
                  : "Todavía sin opiniones"
              }
              lead={
                ratingSummary.count > 0
                  ? undefined
                  : "Sé la primera persona en contar cómo estuvo."
              }
            />

            {event.ratings.length > 0 && (
              <ul className="mt-10 flex flex-col gap-4">
                {event.ratings.map((rating) => (
                  <li key={rating.id} className="card-bz p-5">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-display text-base text-bone">
                        {rating.authorName}
                      </p>
                      <Stars value={rating.rating} size="sm" />
                    </div>
                    {rating.comment && (
                      <p className="mt-3 text-sm leading-relaxed text-muted">
                        {rating.comment}
                      </p>
                    )}
                    <p className="mt-3 text-xs text-muted-dark">
                      {formatDate(rating.createdAt, { month: "short" })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="font-display text-2xl text-bone">
              {isPast ? "Cuéntanos cómo estuvo" : "Calificaciones"}
            </h2>

            <div className="mt-6">
              {event.ratingLock ? (
                <p className="card-bz p-6 text-sm text-muted">
                  Las calificaciones de este evento están cerradas.
                </p>
              ) : isPast ? (
                <RatingForm eventId={event.id} />
              ) : (
                <p className="card-bz p-6 text-sm text-muted">
                  Podrás calificar este evento una vez que se haya
                  realizado. ¡Te esperamos!
                </p>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* Relacionados */}
      {related.length > 0 && (
        <Section className="container-bz border-t border-line">
          <SectionHeading
            eyebrow="Te puede interesar"
            title="Otras noches en BARZUO"
          />

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item, index) => (
              <Reveal key={item.id} delay={index * 70}>
                <EventCard event={item} />
              </Reveal>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function InfoCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 bg-ink-soft p-4">
      <dt className="flex items-center gap-2 text-[0.6rem] tracking-[0.18em] text-muted uppercase">
        <span className="text-crimson">{icon}</span>
        {label}
      </dt>
      <dd className="font-display text-lg text-bone">{value}</dd>
    </div>
  );
}
