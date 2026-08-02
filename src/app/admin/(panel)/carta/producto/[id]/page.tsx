import { notFound } from "next/navigation";

import { MenuProductForm } from "@/components/admin/menu-forms";
import { AdminHeader } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Editar producto" };

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product, categories] = await Promise.all([
    prisma.menuProduct.findUnique({ where: { id } }),
    prisma.menuCategory.findMany({
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!product) notFound();

  return (
    <>
      <AdminHeader
        title={product.name}
        description="Editá los datos del producto."
        back={{ href: "/admin/carta", label: "Volver a la carta" }}
      />
      <MenuProductForm
        categories={categories}
        product={{
          id: product.id,
          categoryId: product.categoryId,
          slug: product.slug,
          name: product.name,
          description: product.description,
          price: (product.priceCents / 100).toString(),
          imageUrl: product.imageUrl,
          available: product.available,
          featured: product.featured,
          tags: product.tags,
        }}
      />
    </>
  );
}
