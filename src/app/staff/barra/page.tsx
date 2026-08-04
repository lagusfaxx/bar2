import { redirect } from "next/navigation";

import { StationBoard } from "@/components/staff/pos/station-board";
import { getPanelSession } from "@/lib/auth";
import { getStationBoard } from "@/lib/pos";

export const dynamic = "force-dynamic";

export const metadata = { title: "Barra" };

export default async function BarraPage() {
  const user = await getPanelSession();

  if (!user) redirect("/staff/login?volver=/staff/barra");

  const tickets = await getStationBoard("BARRA");

  return <StationBoard station="BARRA" tickets={tickets} />;
}
