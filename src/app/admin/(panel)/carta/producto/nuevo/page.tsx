import { redirect } from "next/navigation";

import { MenuProductForm } from "@/components/admin/menu-forms";
import { AdminHeader } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Nuevo producto" };

export default async function NuevoProductoPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { categoria } = await searchParams;

  const categories = await prisma.menuCategory.findMany({
    orderBy: { position: "asc" },
    select: { id: true, name: true },
  });

  // Sin categorías no se puede cargar un producto.
  if (categories.length === 0) {
    redirect("/admin/carta/categoria/nueva");
  }

  return (
    <>
      <AdminHeader
        title="Nuevo producto"
        description="Cargá el producto y elegí en qué categoría se muestra."
        back={{ href: "/admin/carta", label: "Volver a la carta" }}
      />
      <MenuProductForm
        categories={categories}
        product={{
          categoryId: categoria ?? categories[0]!.id,
          available: true,
        }}
      />
    </>
  );
}
