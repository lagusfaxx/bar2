import { notFound, redirect } from "next/navigation";

import { Account } from "@/components/staff/pos/account";
import { getPanelSession } from "@/lib/auth";
import {
  getFrequentProducts,
  getPosMenu,
  getPromotionOffersByTab,
  getSessionDetail,
  type PromotionOffer,
} from "@/lib/pos";
import { posVersion } from "@/lib/pos-version";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cuenta",
};

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ nueva?: string }>;
}) {
  const [{ sessionId }, { nueva }, user] = await Promise.all([
    params,
    searchParams,
    getPanelSession(),
  ]);

  if (!user) redirect(`/staff/login?volver=/staff/pos/${sessionId}`);

  // La carta se pasa entera al cliente: son unos pocos cientos de productos y
  // asi el garzon busca y carga sin esperar una peticion por toque.
  const [session, menu, frequent, version] = await Promise.all([
    getSessionDetail(sessionId),
    getPosMenu(),
    getFrequentProducts(),
    // Marca del estado de la cuenta: la pantalla pregunta por ella cada quince
    // segundos y solo se rearma si cambio (ver lib/pos-version.ts).
    posVersion({ kind: "cuenta", sessionId }),
  ]);

  if (!session) notFound();

  /*
   * Beneficios resueltos por pestaña.
   *
   * Se calculan en el servidor —el descuento depende de lo que hay cargado en
   * esa cuenta— y viajan ya listos: la garzona abre la hoja y ve la plata, sin
   * esperar una consulta con el cliente delante. Sin tarjeta presentada la
   * lista viene vacia y no se consulta nada.
   */
  const offers: Record<string, PromotionOffer[]> = {};

  if (session.card) {
    const porPestaña = await getPromotionOffersByTab(
      session.id,
      session.tabs.map((tab) => tab.dinerId),
    );

    for (const tab of session.tabs) {
      offers[tab.dinerId ?? "mesa"] = porPestaña.get(tab.dinerId) ?? [];
    }
  }

  return (
    <Account
      session={session}
      menu={menu}
      frequent={frequent}
      offers={offers}
      version={version}
      // Recien abierta: se entra directo a cargar el pedido.
      autoOpenPicker={nueva === "1"}
    />
  );
}
