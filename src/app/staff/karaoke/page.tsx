import { redirect } from "next/navigation";

import { KaraokeBoard } from "@/components/staff/karaoke/board";
import { getPanelSession } from "@/lib/auth";
import { getKaraokeBoard, getKaraokeTables } from "@/lib/karaoke";
import { youtubeConfigured } from "@/lib/youtube";

/** La cola cambia a cada rato: nunca se cachea. */
export const dynamic = "force-dynamic";

export const metadata = { title: "Karaoke" };

export default async function KaraokePage() {
  const user = await getPanelSession();

  if (!user) redirect("/staff/login?volver=/staff/karaoke");

  const [board, tables] = await Promise.all([
    getKaraokeBoard(),
    getKaraokeTables(),
  ]);

  return (
    <KaraokeBoard
      board={board}
      tables={tables}
      youtubeReady={youtubeConfigured()}
    />
  );
}
