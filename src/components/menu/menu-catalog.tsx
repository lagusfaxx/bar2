import Image from "next/image";

import { MenuNav } from "@/components/menu/menu-nav";
import { MenuSections } from "@/components/menu/menu-sections";
import { Reveal } from "@/components/ui/reveal";
import { Badge } from "@/components/ui/section";
import type { MenuCategoryWithProducts } from "@/lib/content";
import { formatPrice } from "@/lib/format";
import { priceFor } from "@/lib/pos";

type MenuCatalogProps = {
  menu: MenuCategoryWithProducts[];
  /**
   * Si se escriben los precios al lado de cada producto.
   *
   * La carta de la web va sin ellos —cualquiera de la competencia puede
   * abrirla— y la del QR de las mesas va con ellos. El resto de la carta
   * (categorias, fotos, descripciones, orden) es exactamente el mismo, asi que
   * se mantiene un solo componente: lo que se carga en el panel se ve igual en
   * las dos, sin listas paralelas que se desincronicen.
   */
  showPrices: boolean;
};

/**
 * La carta completa: barra de categorias y secciones con sus productos.
 *
 * La comparten /carta (sin precios) y /carta/mesa (con precios).
 */
export function MenuCatalog({ menu, showPrices }: MenuCatalogProps) {
  return (
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
              {category.products.map((product, index) => {
                const price = priceFor(product);

                return (
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

                          {/* Línea punteada al estilo de una carta impresa.
                              Sin precio no lleva a ninguna parte, así que solo
                              se dibuja en la carta de la mesa. */}
                          {showPrices && (
                            <span
                              aria-hidden
                              className="hidden min-w-6 flex-1 translate-y-[-0.2rem] border-b border-dotted border-line sm:block"
                            />
                          )}

                          {showPrices && (
                            <span className="ml-auto font-display text-base tabular-nums sm:ml-0 sm:text-xl">
                              {price.discountCents > 0 ? (
                                <>
                                  <s className="mr-2 text-sm text-muted">
                                    {formatPrice(product.priceCents)}
                                  </s>
                                  <span className="text-gilt-soft">
                                    {formatPrice(
                                      product.priceCents - price.discountCents,
                                    )}
                                  </span>
                                </>
                              ) : (
                                <span className="text-bone">
                                  {formatPrice(product.priceCents)}
                                </span>
                              )}
                            </span>
                          )}
                        </div>

                        {product.description && (
                          <p className="mt-1 text-[0.82rem] leading-relaxed text-muted sm:mt-1.5 sm:text-sm">
                            {product.description}
                          </p>
                        )}

                        {(product.featured ||
                          product.tags.length > 0 ||
                          (showPrices && price.discountLabel)) && (
                          <div className="mt-2 flex flex-wrap gap-2 sm:mt-3">
                            {product.featured && (
                              <Badge tone="gilt">Recomendado</Badge>
                            )}
                            {/* La etiqueta de la promo ("2x1", "Happy hour")
                                acompaña al precio rebajado: sin precios a la
                                vista no se entiende de qué rebaja habla. */}
                            {showPrices && price.discountLabel && (
                              <Badge tone="crimson">{price.discountLabel}</Badge>
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
                );
              })}
            </ul>
          ),
        }))}
      />
    </>
  );
}
