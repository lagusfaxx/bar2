import { Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { LOYALTY_LINKS, NAV_LINKS } from "@/components/site/nav-links";
import { SocialIcon } from "@/components/site/social-icon";
import { WEEKDAY_LABELS } from "@/lib/format";
import type { getOpeningHours, getSettings, getSocialLinks } from "@/lib/content";

type FooterProps = {
  settings: Awaited<ReturnType<typeof getSettings>>;
  social: Awaited<ReturnType<typeof getSocialLinks>>;
  hours: Awaited<ReturnType<typeof getOpeningHours>>;
};

export function SiteFooter({ settings, social, hours }: FooterProps) {
  const year = new Date().getFullYear();
  const mapsQuery = encodeURIComponent(
    `${settings.address}, ${settings.addressCity}`,
  );

  return (
    <footer className="relative border-t border-line bg-ink-soft">
      <div className="container-bz py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Identidad */}
          <div className="lg:col-span-4">
            <Link href="/" aria-label={`${settings.barName} — inicio`}>
              <Logo
                src={settings.logoUrl}
                name={settings.barName}
                tagline={settings.tagline}
              />
            </Link>

            {settings.footerNote && (
              <p className="mt-6 max-w-sm text-sm leading-relaxed text-muted">
                {settings.footerNote}
              </p>
            )}

            {social.length > 0 && (
              <ul className="mt-8 flex flex-wrap gap-3">
                {social.map((link) => (
                  <li key={link.id}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={link.label}
                      title={link.label}
                      className="flex size-11 items-center justify-center border border-line text-bone-dim transition-all duration-500 hover:-translate-y-0.5 hover:border-crimson hover:text-crimson-bright"
                    >
                      <SocialIcon platform={link.platform} className="size-4" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Navegacion */}
          <nav aria-label="Secciones" className="lg:col-span-2">
            <h2 className="eyebrow mb-5 text-bone">Secciones</h2>
            <ul className="flex flex-col gap-3">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted transition-colors hover:text-crimson-bright"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* BarzuCard */}
          {settings.loyaltyEnabled && (
            <nav aria-label={settings.loyaltyTitle} className="lg:col-span-2">
              <h2 className="eyebrow mb-5 text-bone">
                {settings.loyaltyTitle}
              </h2>
              <ul className="flex flex-col gap-3">
                {LOYALTY_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted transition-colors hover:text-crimson-bright"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {/* Contacto */}
          <div className="lg:col-span-4">
            <h2 className="eyebrow mb-5 text-bone">Dónde encontrarnos</h2>

            <ul className="flex flex-col gap-4 text-sm text-muted">
              <li>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 transition-colors hover:text-bone"
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-crimson" aria-hidden />
                  <span>
                    {settings.address}
                    <span className="block text-muted-dark">
                      {settings.addressCity}
                    </span>
                  </span>
                </a>
              </li>

              {settings.phone && (
                <li>
                  <a
                    href={`tel:${settings.phone.replace(/\s/g, "")}`}
                    className="flex items-center gap-3 transition-colors hover:text-bone"
                  >
                    <Phone className="size-4 shrink-0 text-crimson" aria-hidden />
                    {settings.phone}
                  </a>
                </li>
              )}

              {settings.email && (
                <li>
                  <a
                    href={`mailto:${settings.email}`}
                    className="flex items-center gap-3 transition-colors hover:text-bone"
                  >
                    <Mail className="size-4 shrink-0 text-crimson" aria-hidden />
                    {settings.email}
                  </a>
                </li>
              )}
            </ul>

            {hours.length > 0 && (
              <>
                <h2 className="eyebrow mt-8 mb-4 text-bone">Horarios</h2>
                <dl className="flex flex-col gap-2 text-sm">
                  {hours.map((hour) => (
                    <div
                      key={hour.id}
                      className="flex items-baseline justify-between gap-4 border-b border-line/60 pb-2"
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
              </>
            )}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-line pt-8 text-xs text-muted-dark sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {settings.barName}. Todos los derechos reservados.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/legales" className="transition-colors hover:text-bone-dim">
              Términos y privacidad
            </Link>
            <Link href="/admin" className="transition-colors hover:text-bone-dim">
              Panel administrativo
            </Link>
            <span className="font-western text-[0.7rem] text-crimson-deep">
              EST. 2024
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
