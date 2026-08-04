import { LogOut, Star, Utensils, Wine } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { logoutPanel } from "@/app/actions/auth";
import { Logo } from "@/components/brand/logo";
import { TableGrid } from "@/components/staff/pos/table-grid";
import { getPanelSession } from "@/lib/auth";
import { getSettings } from "@/lib/content";
import { getTablesOverview } from "@/lib/pos";

/** Sala: el estado de las mesas cambia cada minuto, nunca se cachea. */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sala",
};

export default async function PosPage() {
  const session = await getPanelSession();

  if (!session) redirect("/staff/login?volver=/staff/pos");

  const [settings, tables] = await Promise.all([
    getSettings(),
    getTablesOverview(),
  ]);

  return (
    <>
      <header className="shrink-0 border-b border-line bg-ink pt-safe">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3">
          <Logo src={settings.logoUrl} name={settings.barName} variant="compact" />

          <div className="flex items-center gap-2">
            <Link
              href="/staff/cocina"
              aria-label="Pantalla de cocina"
              title="Cocina"
              className="flex size-10 items-center justify-center border border-line text-muted transition-colors hover:border-crimson hover:text-crimson-bright"
            >
              <Utensils className="size-4" aria-hidden />
            </Link>

            <Link
              href="/staff/barra"
              aria-label="Pantalla de barra"
              title="Barra"
              className="flex size-10 items-center justify-center border border-line text-muted transition-colors hover:border-crimson hover:text-crimson-bright"
            >
              <Wine className="size-4" aria-hidden />
            </Link>

            <Link
              href="/staff"
              aria-label="Verificar BarzuCard"
              title="Verificar BarzuCard"
              className="flex size-10 items-center justify-center border border-line text-muted transition-colors hover:border-crimson hover:text-crimson-bright"
            >
              <Star className="size-4" aria-hidden />
            </Link>

            <form action={logoutPanel}>
              <button
                type="submit"
                aria-label="Cerrar sesión"
                className="flex size-10 items-center justify-center border border-line text-muted transition-colors hover:border-crimson hover:text-crimson-bright"
              >
                <LogOut className="size-4" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full min-h-0 max-w-2xl flex-1 overflow-y-auto overscroll-contain px-4 py-6 pb-safe">
        <h1 className="font-display text-2xl text-bone">Sala</h1>
        <p className="mt-2 text-sm text-muted">
          Toca una mesa para abrirla o para seguir su cuenta.
        </p>

        <div className="mt-6">
          <TableGrid tables={tables} />
        </div>
      </main>
    </>
  );
}
