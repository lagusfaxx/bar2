import { PromotionForm } from "@/components/admin/promotion-form";
import { AdminHeader } from "@/components/admin/ui";
import { toDateInput } from "@/lib/format";
import { getMenuTargets } from "@/lib/menu-targets";

export const metadata = { title: "Nueva promoción" };

export default async function NuevaPromocionPage() {
  const menu = await getMenuTargets();

  return (
    <>
      <AdminHeader
        title="Nueva promoción"
        description="Define el beneficio y las reglas con las que se puede canjear."
        back={{ href: "/admin/promociones", label: "Volver a promociones" }}
      />
      <PromotionForm
        menu={menu}
        promotion={{
          type: "PERCENT_OFF",
          scope: "CUENTA",
          active: true,
          maxPerCard: 1,
          maxTotal: 0,
          startsAt: toDateInput(new Date()),
          availableWeekdays: [],
        }}
      />
    </>
  );
}
