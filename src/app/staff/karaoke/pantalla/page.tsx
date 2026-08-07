import { redirect } from "next/navigation";

import { KaraokeScreen } from "@/components/staff/karaoke/screen";
import { getPanelSession } from "@/lib/auth";
import { getKaraokeScreen } from "@/lib/karaoke";

export const dynamic = "force-dynamic";

export const metadata = { title: "Karaoke · Pantalla" };

/**
 * La pantalla del proyector.
 *
 * Pide sesion igual que el resto de /staff: se abre una vez en el navegador de
 * la TV y queda. Conviene que ese navegador sea el que tiene iniciada la
 * cuenta de YouTube del local, porque de esa sesion —y de ningun ajuste de
 * esta app— depende que la reproduccion salga sin avisos.
 */
export default async function KaraokePantallaPage() {
  const user = await getPanelSession();

  if (!user) redirect("/staff/login?volver=/staff/karaoke/pantalla");

  const { singing, queue } = await getKaraokeScreen();

  return <KaraokeScreen singing={singing} queue={queue} />;
}
