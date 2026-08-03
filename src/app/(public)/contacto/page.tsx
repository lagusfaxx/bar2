import { Mail, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";

import { ContactForm } from "@/components/site/contact-form";
import { SocialIcon } from "@/components/site/social-icon";
import { PageHeader } from "@/components/ui/page-header";
import { Reveal } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";
import { getOpeningHours, getSettings, getSocialLinks } from "@/lib/content";
import { WEEKDAY_LABELS } from "@/lib/format";
import { absoluteUrl } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const description = `Reserva tu mesa, consulta por eventos privados o escríbenos. Contacto de ${settings.barName}.`;

  return {
    title: "Contacto",
    description,
    alternates: { canonical: absoluteUrl("/contacto") },
    openGraph: {
      title: `Contacto · ${settings.barName}`,
      description,
      url: absoluteUrl("/contacto"),
    },
  };
}

export default async function ContactoPage() {
  const [settings, social, hours] = await Promise.all([
    getSettings(),
    getSocialLinks(),
    getOpeningHours(),
  ]);

  const whatsappUrl = settings.whatsapp
    ? `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`
    : null;

  return (
    <>
      <PageHeader
        eyebrow="Contacto"
        title="Escríbenos"
        lead={
          settings.reservationsNote ??
          "Reservas, eventos privados, propuestas de bandas o cualquier consulta."
        }
        image="/demo/gallery-2.jpg"
      />

      <Section className="container-bz">
        <div className="grid gap-14 lg:grid-cols-[1fr_20rem] lg:gap-16">
          <Reveal>
            <h2 className="font-display text-2xl text-bone sm:text-3xl">
              Cuéntanos qué necesitas
            </h2>
            <p className="mt-3 text-sm text-muted">
              Respondemos de martes a sábado. Para reservas del mismo día,
              conviene llamarnos.
            </p>

            <div className="mt-9">
              <ContactForm />
            </div>
          </Reveal>

          <Reveal delay={120} className="flex flex-col gap-6">
            <div className="card-bz p-6">
              <h2 className="eyebrow mb-5 text-bone">Datos directos</h2>

              <ul className="flex flex-col gap-4 text-sm">
                {settings.phone && (
                  <li>
                    <a
                      href={`tel:${settings.phone.replace(/\s/g, "")}`}
                      className="flex items-start gap-3 text-muted transition-colors hover:text-bone"
                    >
                      <Phone className="mt-0.5 size-4 shrink-0 text-crimson" aria-hidden />
                      <span>
                        <span className="block text-bone-dim">Teléfono</span>
                        {settings.phone}
                      </span>
                    </a>
                  </li>
                )}

                {whatsappUrl && (
                  <li>
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 text-muted transition-colors hover:text-bone"
                    >
                      <span className="mt-0.5 shrink-0 text-crimson">
                        <SocialIcon platform="whatsapp" className="size-4" />
                      </span>
                      <span>
                        <span className="block text-bone-dim">WhatsApp</span>
                        Reservas y consultas rápidas
                      </span>
                    </a>
                  </li>
                )}

                {settings.email && (
                  <li>
                    <a
                      href={`mailto:${settings.email}`}
                      className="flex items-start gap-3 text-muted transition-colors hover:text-bone"
                    >
                      <Mail className="mt-0.5 size-4 shrink-0 text-crimson" aria-hidden />
                      <span>
                        <span className="block text-bone-dim">Email</span>
                        {settings.email}
                      </span>
                    </a>
                  </li>
                )}

                <li>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${settings.latitude},${settings.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 text-muted transition-colors hover:text-bone"
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-crimson" aria-hidden />
                    <span>
                      <span className="block text-bone-dim">Dirección</span>
                      {settings.address}
                      <span className="block text-muted-dark">
                        {settings.addressCity}
                      </span>
                    </span>
                  </a>
                </li>
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
    </>
  );
}
