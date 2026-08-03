import { MenuCategoryForm } from "@/components/admin/menu-forms";
import { AdminHeader } from "@/components/admin/ui";

export const metadata = { title: "Nueva categoría" };

export default function NuevaCategoriaPage() {
  return (
    <>
      <AdminHeader
        title="Nueva categoría"
        description="Agrupa los productos de la carta por tipo."
        back={{ href: "/admin/carta", label: "Volver a la carta" }}
      />
      <MenuCategoryForm />
    </>
  );
}
