import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getOpeningHours, getSettings, getSocialLinks } from "@/lib/content";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, social, hours] = await Promise.all([
    getSettings(),
    getSocialLinks(),
    getOpeningHours(),
  ]);

  return (
    <>
      {/* Salto de navegacion para lectores de pantalla y teclado. */}
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:bg-crimson focus:px-5 focus:py-3 focus:text-sm focus:text-bone"
      >
        Saltar al contenido
      </a>

      <SiteHeader
        barName={settings.barName}
        tagline={settings.tagline}
        logoUrl={settings.logoUrl}
        loyaltyEnabled={settings.loyaltyEnabled}
        loyaltyTitle={settings.loyaltyTitle}
      />

      <main id="contenido" className="flex-1">
        {children}
      </main>

      <SiteFooter settings={settings} social={social} hours={hours} />
    </>
  );
}
