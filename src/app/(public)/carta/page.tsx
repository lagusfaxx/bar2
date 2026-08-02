import type { Metadata } from "next";
import Image from "next/image";

import { MenuNav } from "@/components/menu/menu-nav";
import { PageHeader } from "@/components/ui/page-header";
import { Reveal } from "@/components/ui/reveal";
import { Badge, Section } from "@/components/ui/section";
import { getMenu, getSettings } from "@/lib/content";
import { formatPrice } from "@/lib/format";
import { absoluteUrl } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const description = `Coctelería de autor, cervezas tiradas, destilados y cocina de bar en ${settings.barName}, ${settings.addressCity}.`;

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
          price: (product.priceCents / 100).toFixed(2),
          priceCurrency: process.env.NEXT_PUBLIC_CURRENCY ?? "UYU",
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
        lead="Coctelería de autor, cervezas bien tiradas y cocina de bar hasta tarde. Todo pensado para compartir mientras suena la música."
        image={menu[0]?.imageUrl ?? "/demo/category-1.jpg"}
      />

      {menu.length === 0 ? (
        <Section className="container-bz">
          <p className="card-bz p-12 text-center text-muted">
            Estamos actualizando la carta. Volvé en un rato.
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

          <div className="pb-10">
            {menu.map((category, categoryIndex) => (
              <Section
                key={category.id}
                id={category.slug}
                className={
                  categoryIndex % 2 === 1
                    ? "border-t border-line bg-ink-soft"
                    : "border-t border-line"
                }
              >
                <div className="container-bz">
                  <div className="grid gap-10 lg:grid-cols-[20rem_1fr] lg:gap-16">
                    {/* Presentación de la categoría */}
                    <Reveal className="lg:sticky lg:top-28 lg:self-start">
                      {category.imageUrl && (
                        <div className="relative mb-6 aspect-4/3 overflow-hidden">
                          <Image
                            src={category.imageUrl}
                            alt=""
                            fill
                            sizes="(max-width: 1024px) 90vw, 20rem"
                            className="object-cover"
                          />
                          <div className="scrim absolute inset-0 opacity-70" />
                        </div>
                      )}

                      <p className="eyebrow mb-3 text-crimson-bright">
                        {String(categoryIndex + 1).padStart(2, "0")}
                      </p>

                      <h2 className="font-display text-[clamp(1.75rem,4vw,2.5rem)] leading-tight text-bone">
                        {category.name}
                      </h2>

                      {category.description && (
                        <p className="mt-4 text-sm leading-relaxed text-muted">
                          {category.description}
                        </p>
                      )}
                    </Reveal>

                    {/* Productos */}
                    <ul className="flex flex-col">
                      {category.products.map((product, index) => (
                        <li key={product.id}>
                          <Reveal
                            delay={Math.min(index, 8) * 45}
                            className="group flex items-start gap-5 border-b border-line py-6 transition-colors duration-500 hover:border-crimson/40"
                          >
                            {product.imageUrl && (
                              <div className="relative size-20 shrink-0 overflow-hidden sm:size-24">
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
                                <h3 className="font-display text-lg leading-snug text-bone transition-colors group-hover:text-crimson-bright sm:text-xl">
                                  {product.name}
                                </h3>

                                {/* Línea punteada al estilo de una carta impresa. */}
                                <span
                                  aria-hidden
                                  className="hidden min-w-6 flex-1 translate-y-[-0.2rem] border-b border-dotted border-line sm:block"
                                />

                                <span className="ml-auto font-display text-lg text-bone tabular-nums sm:ml-0 sm:text-xl">
                                  {formatPrice(product.priceCents)}
                                </span>
                              </div>

                              {product.description && (
                                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                                  {product.description}
                                </p>
                              )}

                              {(product.featured || product.tags.length > 0) && (
                                <div className="mt-3 flex flex-wrap gap-2">
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
                  </div>
                </div>
              </Section>
            ))}
          </div>

          <div className="container-bz pb-24">
            <p className="border-t border-line pt-8 text-xs text-muted-dark">
              Los precios están expresados en pesos uruguayos e incluyen
              impuestos. La carta puede variar según disponibilidad.
            </p>
          </div>
        </>
      )}
    </>
  );
}
