import { countAudience } from "@/app/actions/admin/campaigns";
import { CampaignForm } from "@/components/admin/campaign-form";
import { AdminHeader } from "@/components/admin/ui";
import { absoluteUrl } from "@/lib/utils";

export const metadata = { title: "Nueva campaña" };

export default async function NuevaCampanaPage() {
  const [suscritos, todos] = await Promise.all([
    countAudience("SUSCRITOS"),
    countAudience("TODOS"),
  ]);

  return (
    <>
      <AdminHeader
        title="Nueva campaña"
        description="Escríbela, guárdala y mándate una prueba. El envío a los socios viene después."
        back={{ href: "/admin/campanas", label: "Campañas" }}
      />

      {/* Las fotos se insertan con su direccion completa: dentro de un correo
          no hay pagina de la que colgar una ruta relativa. */}
      <CampaignForm suscritos={suscritos} todos={todos} siteUrl={absoluteUrl("")} />
    </>
  );
}
