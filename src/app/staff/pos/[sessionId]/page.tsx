import { notFound, redirect } from "next/navigation";

import { Account } from "@/components/staff/pos/account";
import { getPanelSession } from "@/lib/auth";
import { getPosMenu, getSessionDetail } from "@/lib/pos";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cuenta",
};

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const user = await getPanelSession();

  if (!user) redirect(`/staff/login?volver=/staff/pos/${sessionId}`);

  // La carta se pasa entera al cliente: son unos pocos cientos de productos y
  // asi el garzon busca y carga sin esperar una peticion por toque.
  const [session, menu] = await Promise.all([
    getSessionDetail(sessionId),
    getPosMenu(),
  ]);

  if (!session) notFound();

  return <Account session={session} menu={menu} />;
}
