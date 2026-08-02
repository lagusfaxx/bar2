import { notFound } from "next/navigation";

import { PromotionForm } from "@/components/admin/promotion-form";
import { AdminHeader } from "@/components/admin/ui";
import { toDateInput } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Editar promoción" };

export default async function EditarPromocionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const promotion = await prisma.promotion.findUnique({ where: { id } });

  if (!promotion) notFound();

  return (
    <>
      <AdminHeader
        title={promotion.title}
        description="Editá el beneficio y sus reglas de canje."
        back={{ href: "/admin/promociones", label: "Volver a promociones" }}
      />
      <PromotionForm
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
          minTier: promotion.minTier,
          maxPerCard: promotion.maxPerCard,
          maxTotal: promotion.maxTotal,
          pointsCost: promotion.pointsCost,
          pointsReward: promotion.pointsReward,
          availableWeekdays: promotion.availableWeekdays,
        }}
      />
    </>
  );
}
