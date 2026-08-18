import { notFound } from "next/navigation";

import { countAudience } from "@/app/actions/admin/campaigns";
import { CampaignForm } from "@/components/admin/campaign-form";
import { AdminHeader } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/utils";

export const metadata = { title: "Campaña" };

export default async function CampanaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [campaign, suscritos, todos] = await Promise.all([
    prisma.campaign.findUnique({ where: { id } }),
    countAudience("SUSCRITOS"),
    countAudience("TODOS"),
  ]);

  if (!campaign) notFound();

  return (
    <>
      <AdminHeader
        title={campaign.name}
        description={
          campaign.status === "DRAFT"
            ? "Borrador. Manda una prueba antes de enviarla a los socios."
            : "Ya enviada. Se conserva tal como salió."
        }
        back={{ href: "/admin/campanas", label: "Campañas" }}
      />

      <CampaignForm
        campaign={{
          id: campaign.id,
          name: campaign.name,
          subject: campaign.subject,
          preheader: campaign.preheader,
          html: campaign.html,
          audience: campaign.audience,
          status: campaign.status,
          sentCount: campaign.sentCount,
          failedCount: campaign.failedCount,
          totalCount: campaign.totalCount,
        }}
        suscritos={suscritos}
        todos={todos}
        siteUrl={absoluteUrl("")}
      />
    </>
  );
}
