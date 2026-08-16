import type { Metadata } from "next";

import { MenuCatalog } from "@/components/menu/menu-catalog";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { getMenu, getSettings } from "@/lib/content";
import { absoluteUrl } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const description = `Empanadas, pizzas a la piedra, chorrillanas, cervezas de barril y promos de barra en ${settings.barName}, ${settings.addressCity}.`;

  return {
    title: "La carta",
    description,
    alternates: { canonical: absoluteUrl("/carta") },
    openGraph: {
      title: `La carta · ${settings.barName}`,
      description,
      url: absoluteUrl("/carta"),
    },
  };
}

/**
 * La carta publica, sin precios.
 *
 * Esta pagina la ve cualquiera, incluida la competencia de la cuadra: muestra
 * que se come y que se toma, pero la lista de precios se guarda para la carta
 * de la mesa (/carta/mesa, el QR que esta sobre cada mesa). Los precios no se
 * "esconden" con CSS: no salen del servidor, asi que no estan en el HTML ni en
 * los datos estructurados que lee Google.
 */
export default async function CartaPage() {
  const [menu, settings] = await Promise.all([getMenu(), getSettings()]);

  // Datos estructurados sin `offers`: un `Menu` de schema.org no obliga a
  // declarar precios, y ponerlos aqui seria filtrar por la puerta de atras
  // justo lo que la pagina no muestra.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Menu",
    name: `Carta de ${settings.barName}`,
    hasMenuSection: menu.map((category) => ({
      "@type": "MenuSection",
      name: category.name,
      description: category.description ?? undefined,
      hasMenuItem: category.products.map((product) => ({
        "@type": "MenuItem",
        name: product.name,
        description: product.description ?? undefined,
      })),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageHeader
        eyebrow="La carta"
        title="Para acompañar la noche"
        lead="Cocina para compartir, pizzas a la piedra, cervezas bien frías y las promos de la barra. Todo hasta que termina la noche."
        image={menu[0]?.imageUrl ?? "/demo/category-1.jpg"}
      />

      {menu.length === 0 ? (
        <Section className="container-bz">
          <p className="card-bz p-12 text-center text-muted">
            Estamos actualizando la carta. Vuelve en un rato.
          </p>
        </Section>
      ) : (
        <>
          <MenuCatalog menu={menu} showPrices={false} />

          <div className="container-bz pb-24">
            <p className="border-t border-line pt-8 text-xs text-muted-dark">
              Los precios están en la carta de la mesa: escanea el código QR al
              llegar o pídesela al equipo de sala. La carta puede variar según
              disponibilidad.
            </p>
          </div>
        </>
      )}
    </>
  );
}
