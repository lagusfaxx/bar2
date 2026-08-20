import { notFound, redirect } from "next/navigation";

import { Account } from "@/components/staff/pos/account";
import { getPanelSession } from "@/lib/auth";
import {
  getFrequentProducts,
  getPosMenu,
  getPromotionOffers,
  getSessionDetail,
  type PromotionOffer,
} from "@/lib/pos";

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
  const [session, menu, frequent] = await Promise.all([
    getSessionDetail(sessionId),
    getPosMenu(),
    getFrequentProducts(),
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
    const porPestaña = await Promise.all(
      session.tabs.map(async (tab) => [
        tab.dinerId ?? "mesa",
        await getPromotionOffers(session.id, tab.dinerId),
      ] as const),
    );

    for (const [key, value] of porPestaña) offers[key] = value;
  }

  return (
    <Account
      session={session}
      menu={menu}
      frequent={frequent}
      offers={offers}
      // Recien abierta: se entra directo a cargar el pedido.
      autoOpenPicker={nueva === "1"}
    />
  );
}
