import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { decideAuthorization } from "@/app/actions/oauth";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { getPanelSession } from "@/lib/auth";
import { getSettings } from "@/lib/content";
import { checkAuthorizeRequest, type AuthorizeParams } from "@/lib/oauth";

export const metadata: Metadata = {
  title: "Autorizar conector",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * La pantalla a la que llega quien agrega el conector de ventas en Claude.
 *
 * Usa el login del panel: si no hay sesion, pasa por /admin/login y vuelve
 * aca. Solo un administrador puede dar acceso a las cifras del negocio.
 */
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params: AuthorizeParams = {};
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(raw)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (v === undefined) continue;
    (params as Record<string, string>)[key] = v;
    query.set(key, v);
  }

  const [session, settings, check] = await Promise.all([
    getPanelSession(),
    getSettings(),
    checkAuthorizeRequest(params),
  ]);

  if (check.ok === false && !check.fatal) redirect(check.redirect);

  if (!session && check.ok) {
    redirect(`/admin/login?volver=${encodeURIComponent(`/oauth/authorize?${query}`)}`);
  }

  let body: React.ReactNode;

  if (!check.ok) {
    body = (
      <>
        <h1 className="font-display text-2xl text-bone">No se puede conectar</h1>
        <p className="mt-3 text-sm text-muted">{check.message}</p>
      </>
    );
  } else if (session?.role !== "ADMIN") {
    body = (
      <>
        <h1 className="font-display text-2xl text-bone">Se requiere un administrador</h1>
        <p className="mt-3 text-sm text-muted">
          Solo una cuenta de administrador puede dar acceso a las ventas. Ingresa con
          una o pídele a quien administra el local que conecte el conector.
        </p>
      </>
    );
  } else {
    const host = new URL(check.redirectUri).host;

    body = (
      <>
        <h1 className="font-display text-2xl text-bone">Conectar {check.client.name}</h1>
        <p className="mt-3 text-sm text-muted">
          <strong className="text-bone">{check.client.name}</strong> quiere acceso de{" "}
          <strong className="text-bone">solo lectura</strong> a los informes de ventas
          del POS: totales, formas de pago, productos, cajeros y cobros anulados.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>No puede cobrar, anular ni cambiar nada.</li>
          <li>Se puede desconectar cuando quieras desde el panel, en «Conectores».</li>
          <li>
            Volverás a <span className="text-bone">{host}</span>.
          </li>
        </ul>
        <p className="mt-4 text-xs text-muted-dark">
          Autorizas como {session.name} ({session.email}).
        </p>

        <form action={decideAuthorization} className="mt-7 flex gap-3">
          {Object.entries(params).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          <Button type="submit" name="decision" value="allow" className="flex-1">
            Permitir
          </Button>
          <Button type="submit" name="decision" value="deny" variant="outline" className="flex-1">
            Cancelar
          </Button>
        </form>
      </>
    );
  }

  return (
    <main className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-5 py-16">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <Logo
            src={settings.logoUrl}
            name={settings.barName}
            tagline="Conectores"
            variant="stacked"
            className="text-4xl"
          />
        </div>

        <div className="card-bz p-7 sm:p-8">{body}</div>
      </div>
    </main>
  );
}
