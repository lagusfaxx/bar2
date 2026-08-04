import { redirect } from "next/navigation";

import { StationBoard } from "@/components/staff/pos/station-board";
import { getPanelSession } from "@/lib/auth";
import { getStationBoard } from "@/lib/pos";

export const dynamic = "force-dynamic";

export const metadata = { title: "Cocina" };

export default async function CocinaPage() {
  const user = await getPanelSession();

  if (!user) redirect("/staff/login?volver=/staff/cocina");

  const tickets = await getStationBoard("COCINA");

  return <StationBoard station="COCINA" tickets={tickets} />;
}
