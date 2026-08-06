import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * La carta, para que el formulario de promociones pueda apuntar a un producto
 * o a una categoria concreta. Se listan tambien los ocultos: una promo puede
 * prepararse antes de publicar el producto.
 */
export async function getMenuTargets() {
  const categories = await prisma.menuCategory.findMany({
    orderBy: { position: "asc" },
    select: {
      id: true,
      name: true,
      products: {
        orderBy: { position: "asc" },
        select: { id: true, name: true, categoryId: true, priceCents: true },
      },
    },
  });

  return {
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
    })),
    products: categories.flatMap((category) =>
      category.products.map((product) => ({
        ...product,
        categoryName: category.name,
      })),
    ),
  };
}
