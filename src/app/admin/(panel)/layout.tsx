import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { getPanelSession } from "@/lib/auth";
import { getSettings } from "@/lib/content";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel BARZUO" },
  robots: { index: false, follow: false },
};

/** El panel siempre refleja el estado actual de la base. */
export const dynamic = "force-dynamic";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPanelSession();

  if (!session) {
    redirect("/admin/login");
  }

  // Los garzones solo acceden a la app de verificación de BarzuCard.
  if (session.role === "STAFF") {
    redirect("/staff");
  }

  const settings = await getSettings();

  return (
    <AdminShell
      session={session}
      barName={settings.barName}
      logoUrl={settings.logoUrl}
    >
      {children}
    </AdminShell>
  );
}
