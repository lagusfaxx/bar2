import { notFound } from "next/navigation";

import { MenuCategoryForm } from "@/components/admin/menu-forms";
import { AdminHeader } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Editar categoría" };

export default async function EditarCategoriaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const category = await prisma.menuCategory.findUnique({ where: { id } });

  if (!category) notFound();

  return (
    <>
      <AdminHeader
        title={category.name}
        description="Edita los datos de la categoría."
        back={{ href: "/admin/carta", label: "Volver a la carta" }}
      />
      <MenuCategoryForm
        category={{
          id: category.id,
          slug: category.slug,
          name: category.name,
          description: category.description,
          imageUrl: category.imageUrl,
          icon: category.icon,
          active: category.active,
          publicMenu: category.publicMenu,
          station: category.station,
        }}
      />
    </>
  );
}
