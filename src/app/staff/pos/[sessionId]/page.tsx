import { notFound, redirect } from "next/navigation";

import { Account } from "@/components/staff/pos/account";
import { getPanelSession } from "@/lib/auth";
import { getFrequentProducts, getPosMenu, getSessionDetail } from "@/lib/pos";

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

  return (
    <Account
      session={session}
      menu={menu}
      frequent={frequent}
      // Recien abierta: se entra directo a cargar el pedido.
      autoOpenPicker={nueva === "1"}
    />
  );
}
