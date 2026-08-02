import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";
import Link from "next/link";

import {
  deleteMenuCategory,
  deleteMenuProduct,
  moveMenuCategory,
  moveMenuProduct,
  toggleMenuCategory,
  toggleMenuProduct,
} from "@/app/actions/admin/menu";
import { ActionButton } from "@/components/admin/action-button";
import { AdminHeader, EmptyState, Panel } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/section";
import { formatPrice } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Carta" };

export default async function AdminCartaPage() {
  const categories = await prisma.menuCategory.findMany({
    orderBy: { position: "asc" },
    include: {
      products: { orderBy: [{ position: "asc" }, { name: "asc" }] },
    },
  });

  return (
    <>
      <AdminHeader
        title="Carta"
        description="Organizá las categorías y los productos que se muestran en la web."
        action={
          <ButtonLink href="/admin/carta/categoria/nueva" size="sm">
            <Plus className="size-4" aria-hidden />
            Nueva categoría
          </ButtonLink>
        }
      />

      {categories.length === 0 ? (
        <EmptyState
          title="La carta está vacía"
          description="Creá la primera categoría (por ejemplo, Coctelería) y después cargá sus productos."
          action={
            <ButtonLink href="/admin/carta/categoria/nueva" size="sm">
              <Plus className="size-4" aria-hidden />
              Crear categoría
            </ButtonLink>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {categories.map((category, index) => (
            <Panel
              key={category.id}
              title={category.name}
              description={`${category.products.length} producto${category.products.length === 1 ? "" : "s"}`}
              action={
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={category.active ? "free" : "muted"}>
                    {category.active ? "Activa" : "Oculta"}
                  </Badge>

                  <ActionButton
                    action={async () => {
                      "use server";
                      await moveMenuCategory(category.id, "up");
                    }}
                    title="Subir"
                    aria-label={`Subir ${category.name}`}
                    className={index === 0 ? "pointer-events-none opacity-30" : ""}
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </ActionButton>

                  <ActionButton
                    action={async () => {
                      "use server";
                      await moveMenuCategory(category.id, "down");
                    }}
                    title="Bajar"
                    aria-label={`Bajar ${category.name}`}
                    className={
                      index === categories.length - 1
                        ? "pointer-events-none opacity-30"
                        : ""
                    }
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </ActionButton>

                  <ActionButton
                    action={async () => {
                      "use server";
                      await toggleMenuCategory(category.id, !category.active);
                    }}
                    title={category.active ? "Ocultar" : "Mostrar"}
                    aria-label={category.active ? "Ocultar" : "Mostrar"}
                  >
                    {category.active ? (
                      <EyeOff className="size-4" aria-hidden />
                    ) : (
                      <Eye className="size-4" aria-hidden />
                    )}
                  </ActionButton>

                  <Link
                    href={`/admin/carta/categoria/${category.id}`}
                    title="Editar categoría"
                    aria-label={`Editar ${category.name}`}
                    className="inline-flex size-9 items-center justify-center border border-line text-muted transition-colors hover:border-crimson hover:text-crimson-bright"
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Link>

                  <ActionButton
                    variant="danger"
                    confirm={`¿Eliminar la categoría "${category.name}" y sus ${category.products.length} productos?`}
                    action={async () => {
                      "use server";
                      await deleteMenuCategory(category.id);
                    }}
                    title="Eliminar categoría"
                    aria-label={`Eliminar ${category.name}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </ActionButton>
                </div>
              }
            >
              {category.products.length === 0 ? (
                <p className="text-sm text-muted">
                  Todavía no hay productos en esta categoría.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {category.products.map((product, productIndex) => (
                    <li
                      key={product.id}
                      className="flex flex-wrap items-center gap-3 border-b border-line/60 py-3 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm text-bone">
                          {product.name}
                          {product.featured && <Badge tone="gilt">Destacado</Badge>}
                          {!product.available && (
                            <Badge tone="muted">Sin stock</Badge>
                          )}
                        </p>
                        {product.description && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                            {product.description}
                          </p>
                        )}
                      </div>

                      <span className="font-display text-base text-bone tabular-nums">
                        {formatPrice(product.priceCents)}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <ActionButton
                          action={async () => {
                            "use server";
                            await moveMenuProduct(product.id, "up");
                          }}
                          title="Subir"
                          aria-label={`Subir ${product.name}`}
                          className={
                            productIndex === 0 ? "pointer-events-none opacity-30" : ""
                          }
                        >
                          <ArrowUp className="size-4" aria-hidden />
                        </ActionButton>

                        <ActionButton
                          action={async () => {
                            "use server";
                            await moveMenuProduct(product.id, "down");
                          }}
                          title="Bajar"
                          aria-label={`Bajar ${product.name}`}
                          className={
                            productIndex === category.products.length - 1
                              ? "pointer-events-none opacity-30"
                              : ""
                          }
                        >
                          <ArrowDown className="size-4" aria-hidden />
                        </ActionButton>

                        <ActionButton
                          action={async () => {
                            "use server";
                            await toggleMenuProduct(
                              product.id,
                              "available",
                              !product.available,
                            );
                          }}
                          title={product.available ? "Marcar sin stock" : "Marcar disponible"}
                          aria-label={
                            product.available ? "Marcar sin stock" : "Marcar disponible"
                          }
                        >
                          {product.available ? (
                            <EyeOff className="size-4" aria-hidden />
                          ) : (
                            <Eye className="size-4" aria-hidden />
                          )}
                        </ActionButton>

                        <ActionButton
                          action={async () => {
                            "use server";
                            await toggleMenuProduct(
                              product.id,
                              "featured",
                              !product.featured,
                            );
                          }}
                          title={product.featured ? "Quitar destacado" : "Destacar"}
                          aria-label={
                            product.featured ? "Quitar destacado" : "Destacar"
                          }
                        >
                          {product.featured ? (
                            <StarOff className="size-4" aria-hidden />
                          ) : (
                            <Star className="size-4" aria-hidden />
                          )}
                        </ActionButton>

                        <Link
                          href={`/admin/carta/producto/${product.id}`}
                          title="Editar producto"
                          aria-label={`Editar ${product.name}`}
                          className="inline-flex size-9 items-center justify-center border border-line text-muted transition-colors hover:border-crimson hover:text-crimson-bright"
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Link>

                        <ActionButton
                          variant="danger"
                          confirm={`¿Eliminar "${product.name}"?`}
                          action={async () => {
                            "use server";
                            await deleteMenuProduct(product.id);
                          }}
                          title="Eliminar producto"
                          aria-label={`Eliminar ${product.name}`}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </ActionButton>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-5 border-t border-line pt-4">
                <ButtonLink
                  href={`/admin/carta/producto/nuevo?categoria=${category.id}`}
                  size="sm"
                  variant="outline"
                >
                  <Plus className="size-4" aria-hidden />
                  Agregar producto
                </ButtonLink>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
