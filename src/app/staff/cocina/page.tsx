import { redirect } from "next/navigation";

import { StationBoard } from "@/components/staff/pos/station-board";
import { getPanelSession } from "@/lib/auth";
import { getStationBoard } from "@/lib/pos";
import { posVersion } from "@/lib/pos-version";

export const dynamic = "force-dynamic";

export const metadata = { title: "Cocina" };

export default async function CocinaPage() {
  const user = await getPanelSession();

  if (!user) redirect("/staff/login?volver=/staff/cocina");

  const [tickets, version] = await Promise.all([
    getStationBoard("COCINA"),
    // Marca del estado del tablero: la pantalla la usa para preguntar si hay
    // algo nuevo antes de rearmarse (ver lib/pos-version.ts).
    posVersion({ kind: "estacion", station: "COCINA" }),
  ]);

  return (
    <StationBoard station="COCINA" tickets={tickets} version={version} />
  );
}
