import { Bus, Car, Mail, MapPin, Navigation, Phone } from "lucide-react";
import type { Metadata } from "next";

import { SocialIcon } from "@/components/site/social-icon";
import { VenueMap } from "@/components/site/venue-map";
import { ButtonAnchor } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Reveal } from "@/components/ui/reveal";
import { Section, SectionHeading } from "@/components/ui/section";
import { getOpeningHours, getSettings, getSocialLinks } from "@/lib/content";
import { WEEKDAY_LABELS } from "@/lib/format";
import { absoluteUrl } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const description = `${settings.barName} está en ${settings.address}, ${settings.addressCity}. Mirá cómo llegar, horarios y datos de contacto.`;

  return {
    title: "Ubicación",
    description,
    alternates: { canonical: absoluteUrl("/ubicacion") },
    openGraph: {
      title: `Ubicación · ${settings.barName}`,
      description,
      url: absoluteUrl("/ubicacion"),
    },
  };
}

export default async function UbicacionPage() {
  const [settings, hours, social] = await Promise.all([
    getSettings(),
    getOpeningHours(),
    getSocialLinks(),
  ]);

  const fullAddress = `${settings.address}, ${settings.addressCity}`;
  const query = encodeURIComponent(fullAddress);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${settings.latitude},${settings.longitude}`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${settings.latitude},${settings.longitude}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BarOrPub",
    name: settings.barName,
    description: settings.seoDescription,
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.address,
      addressLocality: settings.addressCity,
      addressCountry: "UY",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: settings.latitude,
      longitude: settings.longitude,
    },
    telephone: settings.phone ?? undefined,
    email: settings.email ?? undefined,
    url: absoluteUrl("/"),
    hasMap: mapsUrl,
    sameAs: social.map((link) => link.url),
    openingHoursSpecification: hours
      .filter((hour) => !hour.closed && hour.opensAt && hour.closesAt)
      .map((hour) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: `https://schema.org/${
          ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
            hour.dayOfWeek
          ]
        }`,
        opens: hour.opensAt,
        closes: hour.closesAt,
      })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageHeader
        eyebrow="Ubicación"
        title="Cómo llegar a BARZUO"
        lead={fullAddress}
        image="/demo/gallery-13.jpg"
      >
        <div className="flex flex-wrap gap-4">
          <ButtonAnchor
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            size="lg"
          >
            <Navigation className="size-4" aria-hidden />
            Cómo llegar
          </ButtonAnchor>
          <ButtonAnchor
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
            size="lg"
          >
            <MapPin className="size-4" aria-hidden />
            Abrir en Google Maps
          </ButtonAnchor>
        </div>
      </PageHeader>

      <Section className="container-bz">
        <div className="grid gap-10 lg:grid-cols-[1fr_22rem] lg:gap-12">
          <Reveal>
            <VenueMap
              latitude={settings.latitude}
              longitude={settings.longitude}
              address={settings.address}
              city={settings.addressCity}
              name={settings.barName}
            />
          </Reveal>

          <Reveal delay={120} className="flex flex-col gap-6">
            <div className="card-bz p-6">
              <h2 className="eyebrow mb-4 text-bone">Dirección</h2>
              <p className="font-display text-xl leading-snug text-bone">
                {settings.address}
              </p>
              <p className="mt-1 text-sm text-muted">{settings.addressCity}</p>

              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 text-sm text-crimson-bright underline-offset-4 hover:underline"
              >
                Ver en el mapa
                <MapPin className="size-3.5" aria-hidden />
              </a>
            </div>

            <div className="card-bz p-6">
              <h2 className="eyebrow mb-4 text-bone">Contacto</h2>
              <ul className="flex flex-col gap-3 text-sm">
                {settings.phone && (
                  <li>
                    <a
                      href={`tel:${settings.phone.replace(/\s/g, "")}`}
                      className="flex items-center gap-3 text-muted transition-colors hover:text-bone"
                    >
                      <Phone className="size-4 text-crimson" aria-hidden />
                      {settings.phone}
                    </a>
                  </li>
                )}
                {settings.email && (
                  <li>
                    <a
                      href={`mailto:${settings.email}`}
                      className="flex items-center gap-3 text-muted transition-colors hover:text-bone"
                    >
                      <Mail className="size-4 text-crimson" aria-hidden />
                      {settings.email}
                    </a>
                  </li>
                )}
              </ul>

              {social.length > 0 && (
                <ul className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
                  {social.map((link) => (
                    <li key={link.id}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={link.label}
                        title={link.label}
                        className="flex size-10 items-center justify-center border border-line text-bone-dim transition-all duration-500 hover:border-crimson hover:text-crimson-bright"
                      >
                        <SocialIcon platform={link.platform} className="size-4" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {hours.length > 0 && (
              <div className="card-bz p-6">
                <h2 className="eyebrow mb-4 text-bone">Horarios</h2>
                <dl className="flex flex-col gap-2 text-sm">
                  {hours.map((hour) => (
                    <div
                      key={hour.id}
                      className="flex items-baseline justify-between gap-4 border-b border-line/60 pb-2 last:border-0"
                    >
                      <dt className="text-muted">
                        {WEEKDAY_LABELS[hour.dayOfWeek]}
                      </dt>
                      <dd className="text-bone-dim tabular-nums">
                        {hour.closed
                          ? "Cerrado"
                          : `${hour.opensAt ?? ""} – ${hour.closesAt ?? ""}`}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </Reveal>
        </div>
      </Section>

      <Section className="border-t border-line bg-ink-soft">
        <div className="container-bz">
          <SectionHeading
            eyebrow="Llegar"
            title="Estamos bien conectados"
            align="center"
          />

          <div className="mt-12 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-3">
            <HowToCell
              icon={<Car className="size-6" aria-hidden />}
              title="En auto"
              text="Estacionamiento sobre la avenida y calles laterales. Los fines de semana conviene llegar temprano."
            />
            <HowToCell
              icon={<Bus className="size-6" aria-hidden />}
              title="En ómnibus"
              text="Varias líneas paran sobre Av. Batlle y Ordóñez, a menos de una cuadra del local."
            />
            <HowToCell
              icon={<Navigation className="size-6" aria-hidden />}
              title="En app de viajes"
              text={`Indicá "${settings.barName}, ${settings.address}" y te deja en la puerta.`}
            />
          </div>

          <p className="mt-8 text-center text-xs text-muted-dark">
            ¿Necesitás ayuda para llegar?{" "}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${query}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-crimson-bright underline-offset-4 hover:underline"
            >
              Abrí la dirección en Google Maps
            </a>
            .
          </p>
        </div>
      </Section>
    </>
  );
}

function HowToCell({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <article className="bg-ink p-8">
      <span className="text-crimson">{icon}</span>
      <h3 className="mt-5 font-display text-xl text-bone">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-muted">{text}</p>
    </article>
  );
}

/** Regeneracion periodica; el CMS ademas invalida al guardar. */
export const revalidate = 300;
