import { SettingsForm } from "@/components/admin/settings-form";
import {
  OpeningHoursManager,
  SocialLinksManager,
} from "@/components/admin/social-hours-forms";
import { AdminHeader } from "@/components/admin/ui";
import { getSettings } from "@/lib/content";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Ajustes del sitio" };

export default async function AdminAjustesPage() {
  const [settings, social, hours] = await Promise.all([
    getSettings(),
    prisma.socialLink.findMany({ orderBy: { position: "asc" } }),
    prisma.openingHour.findMany({ orderBy: { dayOfWeek: "asc" } }),
  ]);

  return (
    <>
      <AdminHeader
        title="Datos del bar y portada"
        description="Todo lo que la web dice sobre el bar: la foto y los textos del inicio, la dirección, el teléfono, los horarios y las redes."
      />

      <div className="flex flex-col gap-8">
        <SettingsForm settings={settings} />
        <SocialLinksManager links={social} />
        <OpeningHoursManager hours={hours} />
      </div>
    </>
  );
}
