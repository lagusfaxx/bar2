import { notFound } from "next/navigation";

import { PromotionForm } from "@/components/admin/promotion-form";
import { AdminHeader } from "@/components/admin/ui";
import { toDateInput } from "@/lib/format";
import { getMenuTargets } from "@/lib/menu-targets";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Editar promoción" };

export default async function EditarPromocionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [promotion, menu] = await Promise.all([
    prisma.promotion.findUnique({ where: { id } }),
    getMenuTargets(),
  ]);

  if (!promotion) notFound();

  return (
    <>
      <AdminHeader
        title={promotion.title}
        description="Edita el beneficio y sus reglas de canje."
        back={{ href: "/admin/promociones", label: "Volver a promociones" }}
      />
      <PromotionForm
        menu={menu}
        promotion={{
          id: promotion.id,
          slug: promotion.slug,
          title: promotion.title,
          description: promotion.description,
          terms: promotion.terms,
          imageUrl: promotion.imageUrl,
          type: promotion.type,
          value:
            promotion.type === "AMOUNT_OFF"
              ? (promotion.value / 100).toString()
              : promotion.value.toString(),
          startsAt: toDateInput(promotion.startsAt),
          endsAt: toDateInput(promotion.endsAt),
          active: promotion.active,
          scope: promotion.scope,
          productId: promotion.productId,
          categoryId: promotion.categoryId,
          maxPerCard: promotion.maxPerCard,
          maxTotal: promotion.maxTotal,
          availableWeekdays: promotion.availableWeekdays,
        }}
      />
    </>
  );
}
