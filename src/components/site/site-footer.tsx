import { ChevronDown, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { LOYALTY_LINKS, NAV_LINKS } from "@/components/site/nav-links";
import { SocialIcon } from "@/components/site/social-icon";
import { groupOpeningHours } from "@/lib/format";
import type { getOpeningHours, getSettings, getSocialLinks } from "@/lib/content";

type FooterProps = {
  settings: Awaited<ReturnType<typeof getSettings>>;
  social: Awaited<ReturnType<typeof getSocialLinks>>;
  hours: Awaited<ReturnType<typeof getOpeningHours>>;
};

/** La semana, una fila por tramo. Se usa dos veces: plegada y abierta. */
function Schedule({
  days,
}: {
  days: ReturnType<typeof groupOpeningHours>;
}) {
  return (
    <dl className="flex flex-col gap-2 text-sm">
      {days.map((day) => (
        <div
          key={day.key}
          className="flex items-baseline justify-between gap-4 border-b border-line/60 pb-2"
        >
          <dt className="text-muted">
            {day.label}
            {day.note && (
              <span className="block text-xs text-muted-dark">{day.note}</span>
            )}
          </dt>
          <dd
            className={
              day.closed ? "text-muted-dark" : "text-bone-dim tabular-nums"
            }
          >
            {day.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function SiteFooter({ settings, social, hours }: FooterProps) {
  const year = new Date().getFullYear();
  // En el telefono el pie era una columna de casi dos pantallas: siete filas
  // de horario, diez enlaces uno bajo otro y todo el contacto debajo.
  const schedule = groupOpeningHours(hours);
  const mapsQuery = encodeURIComponent(
    `${settings.address}, ${settings.addressCity}`,
  );

  return (
    <footer className="relative border-t border-line bg-ink-soft">
      <div className="container-bz py-12 sm:py-16 lg:py-20">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:gap-y-12 lg:grid-cols-12 lg:gap-8">
          {/* Identidad */}
          <div className="col-span-2 lg:col-span-4">
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
          <div className="col-span-2 lg:col-span-4">
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

            {schedule.length > 0 && (
              <>
                {/* Telefono: plegado. La semana entera son siete filas —mas las
                    notas de cada dia— y era el bloque que estiraba el pie sin
                    que nadie lo estuviera buscando. Queda a un toque. */}
                <details className="group mt-8 border-t border-line pt-6 sm:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
                    <span className="eyebrow text-bone">Horarios</span>
                    <ChevronDown
                      className="size-4 shrink-0 text-crimson transition-transform duration-300 group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <div className="mt-5">
                    <Schedule days={schedule} />
                  </div>
                </details>

                {/* De tablet para arriba el pie va en columnas y el espacio
                    sobra: no hay nada que plegar. */}
                <div className="hidden sm:block">
                  <h2 className="eyebrow mt-8 mb-4 text-bone">Horarios</h2>
                  <Schedule days={schedule} />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-5 border-t border-line pt-8 text-xs text-muted-dark sm:mt-16 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <p>
              © {year} {settings.barName}. Todos los derechos reservados.
            </p>
            <p>
              Desarrollada y creada por{" "}
              <a
                href="https://wa.me/56944369218"
                target="_blank"
                rel="noopener noreferrer"
                className="text-bone-dim underline-offset-4 transition-colors hover:text-crimson-bright hover:underline"
              >
                Andes Technologies
              </a>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/legales" className="transition-colors hover:text-bone-dim">
              Términos y privacidad
            </Link>
            {/*
              La puerta del equipo, en el renglon de siempre.

              Va aca y no arriba por una razon de oficio: el sitio es la cara
              del bar y su portada se le muestra a un cliente, no a un turno
              entrante. Un boton de "ingresar" compitiendo con la cartelera le
              dice al que llega que esto es un sistema, cuando lo que tiene que
              decirle es que esto es un bar.

              Abajo, en cambio, no le quita nada a nadie y esta en todas las
              paginas: el garzon que abre el sitio en su telefono llega igual,
              y para el es un lugar que se aprende una vez. Es el mismo trato
              que ya recibia el panel, y por eso comparten renglon.

              Apunta a /staff y no a /staff/login: con la sesion abierta —que
              es lo normal a mitad de un turno— entra derecho a la sala en vez
              de pedir la clave de nuevo.
            */}
            <Link href="/staff" className="transition-colors hover:text-bone-dim">
              App de sala
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
