import type { Metadata } from "next";
import Image from "next/image";

import { MenuNav } from "@/components/menu/menu-nav";
import { MenuSections } from "@/components/menu/menu-sections";
import { PageHeader } from "@/components/ui/page-header";
import { Reveal } from "@/components/ui/reveal";
import { Badge, Section } from "@/components/ui/section";
import { getMenu, getSettings } from "@/lib/content";
import { formatPrice } from "@/lib/format";
import { priceFor } from "@/lib/pos";
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

export default async function CartaPage() {
  const [menu, settings] = await Promise.all([getMenu(), getSettings()]);

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
        offers: {
          "@type": "Offer",
          price: (
            (product.priceCents - priceFor(product).discountCents) / 100
          ).toFixed(2),
          priceCurrency: process.env.NEXT_PUBLIC_CURRENCY ?? "CLP",
        },
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
          <MenuNav
            categories={menu.map((category) => ({
              slug: category.slug,
              name: category.name,
            }))}
          />

          <MenuSections
            sections={menu.map((category, categoryIndex) => ({
              slug: category.slug,
              name: category.name,
              count: category.products.length,

              // Presentación de la categoría. La foto y el título grande son
              // para la columna de escritorio: en el teléfono ese lugar ya lo
              // ocupa la cabecera plegable.
              aside: (
                <Reveal
                  key={`aside-${category.id}`}
                  className="lg:sticky lg:top-28 lg:self-start"
                >
                  {category.imageUrl && (
                    <div className="relative mb-6 hidden aspect-4/3 overflow-hidden lg:block">
                      <Image
                        src={category.imageUrl}
                        alt=""
                        fill
                        sizes="20rem"
                        className="object-cover"
                      />
                      <div className="scrim absolute inset-0 opacity-70" />
                    </div>
                  )}

                  <p className="eyebrow mb-3 hidden text-crimson-bright lg:block">
                    {String(categoryIndex + 1).padStart(2, "0")}
                  </p>

                  <h2 className="hidden font-display text-[clamp(1.75rem,4vw,2.5rem)] leading-tight text-bone lg:block">
                    {category.name}
                  </h2>

                  {category.description && (
                    <p className="text-sm leading-relaxed text-muted lg:mt-4">
                      {category.description}
                    </p>
                  )}
                </Reveal>
              ),

              items: (
                <ul key={`items-${category.id}`} className="flex flex-col">
                  {category.products.map((product, index) => (
                    <li key={product.id}>
                      <Reveal
                        delay={Math.min(index, 8) * 45}
                        className="group flex items-start gap-4 border-b border-line py-4 transition-colors duration-500 hover:border-crimson/40 sm:gap-5 sm:py-6"
                      >
                        {product.imageUrl && (
                          <div className="relative hidden size-20 shrink-0 overflow-hidden sm:block sm:size-24">
                            <Image
                              src={product.imageUrl}
                              alt={product.name}
                              fill
                              sizes="96px"
                              className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110"
                            />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-3">
                            <h3 className="font-display text-base leading-snug text-bone transition-colors group-hover:text-crimson-bright sm:text-xl">
                              {product.name}
                            </h3>

                            {/* Línea punteada al estilo de una carta impresa. */}
                            <span
                              aria-hidden
                              className="hidden min-w-6 flex-1 translate-y-[-0.2rem] border-b border-dotted border-line sm:block"
                            />

                            <span className="ml-auto font-display text-base tabular-nums sm:ml-0 sm:text-xl">
                              {priceFor(product).discountCents > 0 ? (
                                <>
                                  <s className="mr-2 text-sm text-muted">
                                    {formatPrice(product.priceCents)}
                                  </s>
                                  <span className="text-gilt-soft">
                                    {formatPrice(
                                      product.priceCents -
                                        priceFor(product).discountCents,
                                    )}
                                  </span>
                                </>
                              ) : (
                                <span className="text-bone">
                                  {formatPrice(product.priceCents)}
                                </span>
                              )}
                            </span>
                          </div>

                          {product.description && (
                            <p className="mt-1 text-[0.82rem] leading-relaxed text-muted sm:mt-1.5 sm:text-sm">
                              {product.description}
                            </p>
                          )}

                          {(product.featured || product.tags.length > 0) && (
                            <div className="mt-2 flex flex-wrap gap-2 sm:mt-3">
                              {product.featured && (
                                <Badge tone="gilt">Recomendado</Badge>
                              )}
                              {product.tags.map((tag) => (
                                <Badge key={tag} tone="muted">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </Reveal>
                    </li>
                  ))}
                </ul>
              ),
            }))}
          />

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
