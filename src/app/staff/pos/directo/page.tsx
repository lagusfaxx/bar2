import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DirectSale } from "@/components/staff/pos/direct-sale";
import { getPanelSession } from "@/lib/auth";
import { getFrequentProducts, getPosMenu } from "@/lib/pos";

/** La carta cambia de precio en el dia: nunca se sirve de cache. */
export const dynamic = "force-dynamic";

export const metadata = { title: "Cobro directo" };

/**
 * Cobro directo: la venta que no pasa por ninguna mesa.
 *
 * Se entra desde la sala, se tocan los productos y se cobra. Es la misma carta
 * del POS —los mismos precios, las mismas promociones vigentes y los mismos
 * "de siempre" arriba—, porque una segunda lista de precios para el mostrador
 * seria una lista que alguien tiene que acordarse de actualizar.
 */
export default async function DirectSalePage() {
  const session = await getPanelSession();

  if (!session) redirect("/staff/login?volver=/staff/pos/directo");

  const [menu, frequent] = await Promise.all([
    getPosMenu(),
    getFrequentProducts(),
  ]);

  return (
    <>
      <header className="shrink-0 border-b border-line bg-ink pt-safe">
        <div className="flex items-center gap-3 px-3 py-3">
          <Link
            href="/staff/pos"
            className="flex size-12 shrink-0 items-center justify-center border border-line text-bone"
            aria-label="Volver a la sala"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>

          <div className="min-w-0">
            <p className="text-xs text-muted">Venta de mostrador</p>
            <h1 className="font-display text-xl text-bone">Cobro directo</h1>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        <DirectSale menu={menu} frequent={frequent} />
      </main>
    </>
  );
}
