import { PromotionForm } from "@/components/admin/promotion-form";
import { AdminHeader } from "@/components/admin/ui";
import { toDateInput } from "@/lib/format";

export const metadata = { title: "Nueva promoción" };

export default function NuevaPromocionPage() {
  return (
    <>
      <AdminHeader
        title="Nueva promoción"
        description="Define el beneficio y las reglas con las que se puede canjear."
        back={{ href: "/admin/promociones", label: "Volver a promociones" }}
      />
      <PromotionForm
        promotion={{
          type: "PERCENT_OFF",
          active: true,
          maxPerCard: 1,
          maxTotal: 0,
          pointsCost: 0,
          pointsReward: 0,
          minTier: "CLASICA",
          startsAt: toDateInput(new Date()),
          availableWeekdays: [],
        }}
      />
    </>
  );
}
