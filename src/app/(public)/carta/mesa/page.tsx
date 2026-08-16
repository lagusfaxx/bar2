import type { Metadata } from "next";

import { MenuCatalog } from "@/components/menu/menu-catalog";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { getMenu, getSettings } from "@/lib/content";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();

  return {
    title: "Carta de la mesa",
    description: `La carta con precios de ${settings.barName}.`,
    // Fuera de Google y del resto de buscadores: a esta carta se llega por el
    // QR de la mesa, no por una busqueda. Sin canonical ni Open Graph, que son
    // justamente las señales que la harian circular.
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: { index: false, follow: false, noimageindex: true },
    },
  };
}

/**
 * La carta con precios, la del QR de las mesas.
 *
 * Es la misma carta de /carta —las mismas categorias, fotos y descripciones,
 * cargadas una sola vez en el panel— pero con el precio de cada producto y las
 * promos vigentes. Vive en una URL aparte, sin enlaces desde el sitio, fuera
 * del sitemap y bloqueada en robots.txt: quien esta en la mesa la abre con la
 * camara, y quien mira la web desde afuera no la encuentra.
 *
 * No es un secreto criptografico —una URL corta se puede teclear— sino la
 * misma discrecion de una carta impresa: esta sobre la mesa, no en la vitrina.
 */
export default async function CartaMesaPage() {
  const menu = await getMenu();

  return (
    <>
      <PageHeader
        eyebrow="Carta de la mesa"
        title="Lo que hay esta noche"
        lead="La carta completa con precios. Cuando elijas, avísale al equipo de sala y lo anotamos en tu mesa."
        image={menu[0]?.imageUrl ?? "/demo/category-1.jpg"}
      />

      {menu.length === 0 ? (
        <Section className="container-bz">
          <p className="card-bz p-12 text-center text-muted">
            Estamos actualizando la carta. Pídele la carta al equipo de sala.
          </p>
        </Section>
      ) : (
        <>
          <MenuCatalog menu={menu} showPrices />

          <div className="container-bz pb-24">
            <p className="border-t border-line pt-8 text-xs text-muted-dark">
              Los precios están expresados en pesos chilenos e incluyen
              impuestos. La carta puede variar según disponibilidad.
            </p>
          </div>
        </>
      )}
    </>
  );
}
