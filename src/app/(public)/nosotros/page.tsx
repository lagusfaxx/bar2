import { Disc3, Martini, Music4, Users } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";

import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Reveal } from "@/components/ui/reveal";
import { Section, SectionHeading } from "@/components/ui/section";
import { getFeaturedGallery, getOpeningHours, getSettings } from "@/lib/content";
import { WEEKDAY_LABELS } from "@/lib/format";
import { absoluteUrl } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const description =
    settings.aboutLead ??
    `Conocé la historia de ${settings.barName}, restobar de música en vivo en ${settings.addressCity}.`;

  return {
    title: "Nosotros",
    description,
    alternates: { canonical: absoluteUrl("/nosotros") },
    openGraph: {
      title: `Nosotros · ${settings.barName}`,
      description,
      url: absoluteUrl("/nosotros"),
      images: settings.aboutImageUrl ? [settings.aboutImageUrl] : undefined,
    },
  };
}

const PILLARS = [
  {
    icon: Music4,
    title: "Música en vivo",
    text: "Bandas y tributos todas las semanas, con sonido e iluminación de sala propios.",
  },
  {
    icon: Martini,
    title: "Coctelería de autor",
    text: "Una barra que trabaja con producto fresco y recetas propias, sin atajos.",
  },
  {
    icon: Disc3,
    title: "DJ hasta el cierre",
    text: "Cuando termina el show, la noche sigue con nuestro residente y invitados.",
  },
  {
    icon: Users,
    title: "Para compartir",
    text: "Mesas amplias, tablas generosas y espacio para grupos y celebraciones.",
  },
];

export default async function NosotrosPage() {
  const [settings, gallery, hours] = await Promise.all([
    getSettings(),
    getFeaturedGallery(4),
    getOpeningHours(),
  ]);

  const paragraphs = settings.aboutBody?.split(/\n{2,}/) ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Nosotros"
        title={settings.aboutTitle ?? "Nuestra historia"}
        lead={settings.aboutLead}
        image={settings.aboutImageUrl ?? "/demo/about-1.jpg"}
      />

      {/* Relato */}
      <Section className="container-bz">
        <div className="grid gap-14 lg:grid-cols-[1.15fr_1fr] lg:gap-20">
          <div>
            {paragraphs.length > 0 ? (
              <div className="flex flex-col gap-6">
                {paragraphs.map((paragraph, index) => (
                  <Reveal key={index} delay={index * 80}>
                    <p
                      className={
                        index === 0
                          ? "font-display text-xl leading-relaxed text-bone sm:text-2xl"
                          : "text-[0.975rem] leading-relaxed text-muted"
                      }
                    >
                      {paragraph}
                    </p>
                  </Reveal>
                ))}
              </div>
            ) : (
              <p className="text-muted">
                Muy pronto vas a poder leer acá la historia de{" "}
                {settings.barName}.
              </p>
            )}

            <Reveal delay={200} className="mt-10 flex flex-wrap gap-4">
              <ButtonLink href="/eventos">Ver la cartelera</ButtonLink>
              <ButtonLink href="/ubicacion" variant="outline">
                Cómo llegar
              </ButtonLink>
            </Reveal>
          </div>

          <Reveal delay={120} className="relative">
            <div className="relative aspect-3/4 overflow-hidden">
              <Image
                src={settings.aboutImageUrl ?? "/demo/about-1.jpg"}
                alt={`Interior de ${settings.barName}`}
                fill
                sizes="(max-width: 1024px) 90vw, 40vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" />
            </div>

            <div className="absolute -bottom-8 -left-6 hidden aspect-square w-40 overflow-hidden border-4 border-ink shadow-lift sm:block">
              <Image
                src={settings.aboutSecondaryImageUrl ?? "/demo/about-2.jpg"}
                alt=""
                fill
                sizes="160px"
                className="object-cover"
              />
            </div>
          </Reveal>
        </div>
      </Section>

      {/* Pilares */}
      <Section className="border-y border-line bg-ink-soft">
        <div className="container-bz">
          <SectionHeading
            eyebrow="El concepto"
            title="Cuatro cosas que hacemos bien"
            align="center"
          />

          <div className="mt-14 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((pillar, index) => (
              <Reveal key={pillar.title} delay={index * 80}>
                <article className="group h-full bg-ink p-8 transition-colors duration-500 hover:bg-surface">
                  <pillar.icon
                    className="size-7 text-crimson transition-transform duration-500 group-hover:scale-110"
                    aria-hidden
                  />
                  <h3 className="mt-6 font-display text-xl text-bone">
                    {pillar.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {pillar.text}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      {/* Horarios */}
      {hours.length > 0 && (
        <Section className="container-bz">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <SectionHeading
              eyebrow="Horarios"
              title="Cuándo abrimos"
              lead={settings.reservationsNote}
            />

            <Reveal delay={100}>
              <dl className="flex flex-col">
                {hours.map((hour) => (
                  <div
                    key={hour.id}
                    className="flex items-baseline justify-between gap-6 border-b border-line py-4"
                  >
                    <dt className="text-base text-bone-dim">
                      {WEEKDAY_LABELS[hour.dayOfWeek]}
                      {hour.note && (
                        <span className="ml-3 text-xs text-crimson-bright">
                          {hour.note}
                        </span>
                      )}
                    </dt>
                    <dd
                      className={
                        hour.closed
                          ? "text-sm text-muted-dark"
                          : "font-display text-lg text-bone tabular-nums"
                      }
                    >
                      {hour.closed
                        ? "Cerrado"
                        : `${hour.opensAt ?? ""} – ${hour.closesAt ?? ""}`}
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </Section>
      )}

      {/* Galería */}
      {gallery.length > 0 && (
        <Section className="border-t border-line">
          <div className="container-bz">
            <SectionHeading
              eyebrow="Galería"
              title="Así se ve una noche acá"
              action={
                <ButtonLink href="/galeria" variant="outline">
                  Ver la galería completa
                </ButtonLink>
              }
            />

            <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {gallery.map((image, index) => (
                <Reveal key={image.id} delay={index * 70}>
                  <figure className="relative aspect-4/5 overflow-hidden">
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
          </div>
        </Section>
      )}
    </>
  );
}
