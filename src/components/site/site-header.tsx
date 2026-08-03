"use client";

import { Menu, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Logo } from "@/components/brand/logo";
import { NAV_LINKS } from "@/components/site/nav-links";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SiteHeaderProps = {
  barName: string;
  tagline: string;
  logoUrl?: string | null;
  loyaltyEnabled: boolean;
  loyaltyTitle: string;
};

export function SiteHeader({
  barName,
  tagline,
  logoUrl,
  loyaltyEnabled,
  loyaltyTitle,
}: SiteHeaderProps) {
  const pathname = usePathname();

  // La barra se vuelve opaca al alejarse del hero. Se lee del scroll real en
  // lugar de duplicarlo en un estado propio.
  const scrolled = useSyncExternalStore(
    (notify) => {
      window.addEventListener("scroll", notify, { passive: true });
      return () => window.removeEventListener("scroll", notify);
    },
    () => window.scrollY > 24,
    () => false,
  );

  // El menu movil se recuerda junto a la ruta en la que se abrio: al navegar,
  // el pathname cambia y queda cerrado sin necesidad de un efecto.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const setOpen = (value: boolean) => setOpenedAt(value ? pathname : null);

  // Con el menu movil abierto se bloquea el scroll del documento.
  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenedAt(null);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          scrolled || open
            ? "border-b border-line/80 bg-ink/92 backdrop-blur-xl"
            : "border-b border-transparent bg-gradient-to-b from-ink/80 to-transparent",
        )}
      >
        <div className="container-bz flex h-18 items-center justify-between gap-6 py-4 sm:h-20">
          <Link
            href="/"
            aria-label={`${barName} — inicio`}
            className="shrink-0 transition-opacity hover:opacity-85"
          >
            <Logo
              src={logoUrl}
              name={barName}
              tagline={tagline}
              variant="compact"
              priority
            />
          </Link>

          <nav
            aria-label="Navegacion principal"
            className="hidden items-center gap-7 lg:flex"
          >
            {NAV_LINKS.filter((link) => link.href !== "/").map((link) => (
              <Link
                key={link.href}
                href={link.href}
                data-active={isActive(link.href)}
                className={cn(
                  "link-underline text-[0.7rem] font-medium uppercase tracking-[0.2em] transition-colors",
                  isActive(link.href)
                    ? "text-bone"
                    : "text-bone-dim hover:text-bone",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {/* En el telefono queda solo el simbolo: la BarzuCard es lo que mas
                se busca desde el movil y no puede depender de abrir el menu. */}
            {loyaltyEnabled && (
              <ButtonLink
                href="/barzucard"
                size="sm"
                variant="outline"
                aria-label={loyaltyTitle}
                className="max-sm:h-11 max-sm:w-11 max-sm:px-0"
              >
                <Sparkles className="size-3.5" aria-hidden />
                <span className="max-sm:sr-only">{loyaltyTitle}</span>
              </ButtonLink>
            )}

            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-controls="menu-movil"
              aria-label={open ? "Cerrar menu" : "Abrir menu"}
              className="flex size-11 items-center justify-center border border-bone/20 text-bone transition-colors hover:border-crimson hover:text-crimson-bright lg:hidden"
            >
              {open ? (
                <X className="size-5" aria-hidden />
              ) : (
                <Menu className="size-5" aria-hidden />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Menu movil a pantalla completa: pensado para el pulgar, no una copia
          reducida del menu de escritorio. */}
      <div
        id="menu-movil"
        hidden={!open}
        className={cn(
          "fixed inset-0 z-40 flex flex-col bg-ink/98 pt-20 backdrop-blur-2xl transition-opacity duration-300 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <nav
          aria-label="Navegacion movil"
          className="container-bz flex flex-1 flex-col overflow-y-auto py-6"
        >
          <ul className="flex flex-col">
            {NAV_LINKS.map((link, index) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="group flex items-baseline justify-between gap-4 border-b border-line/70 py-5 transition-colors"
                  style={{ transitionDelay: `${index * 25}ms` }}
                >
                  <span className="flex flex-col gap-1">
                    <span
                      className={cn(
                        "font-display text-2xl transition-colors",
                        isActive(link.href)
                          ? "text-crimson-bright"
                          : "text-bone group-hover:text-crimson-bright",
                      )}
                    >
                      {link.label}
                    </span>
                    {link.description && (
                      <span className="text-xs text-muted">
                        {link.description}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-[0.65rem] text-muted-dark">
                    0{index + 1}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {loyaltyEnabled && (
            <ButtonLink href="/barzucard" size="lg" className="mt-8 w-full">
              <Sparkles className="size-4" aria-hidden />
              Quiero mi {loyaltyTitle}
            </ButtonLink>
          )}
        </nav>
      </div>
    </>
  );
}
