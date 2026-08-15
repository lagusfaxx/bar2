import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getPanelSession } from "@/lib/auth";
import { getSettings } from "@/lib/content";
import { prisma } from "@/lib/prisma";
import { menuQrDataUrl } from "@/lib/qr";
import { absoluteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Carta · QR de las mesas",
  robots: { index: false, follow: false },
};

/** Cuántos carteles imprimir cuando todavía no hay mesas cargadas en el panel. */
const DEFAULT_COPIES = 8;

/**
 * Los carteles con el QR de la carta, para pegar en las mesas.
 *
 * El QR lleva a /carta/mesa, la unica carta con precios. Es el mismo codigo
 * para todas las mesas —solo abre la carta, no identifica a nadie— asi que la
 * hoja repite un cartel por mesa cargada en el panel, con su numero, y asi se
 * imprime, se recorta y se reparte de una sola vez.
 *
 * Vive fuera del grupo (panel): la hoja es para papel —fondo blanco, tinta
 * negra— y la barra lateral del panel solo gastaria toner.
 */
export default async function MenuQrPage() {
  const user = await getPanelSession();

  if (!user) redirect("/admin/login?volver=/admin/carta/qr");

  const [tables, settings, qr] = await Promise.all([
    prisma.posTable.findMany({
      where: { active: true },
      orderBy: [{ position: "asc" }, { number: "asc" }],
      select: { id: true, number: true, name: true, zone: true },
    }),
    getSettings(),
    menuQrDataUrl(),
  ]);

  // Sin mesas cargadas igual sirve: se imprime una tanda de carteles sin
  // numero y se pegan donde haga falta.
  const signs =
    tables.length > 0
      ? tables.map((table) => ({
          key: table.id,
          label: `Mesa ${table.number}`,
          hint: table.name ?? table.zone,
        }))
      : Array.from({ length: DEFAULT_COPIES }, (_, index) => ({
          key: `sin-mesa-${index}`,
          label: null,
          hint: null,
        }));

  return (
    <div className="min-h-[100dvh] bg-white text-black">
      {/* La barra no se imprime: en el papel solo van los carteles. */}
      <header className="flex items-center gap-3 border-b border-neutral-300 px-4 py-3 print:hidden">
        <Link
          href="/admin/carta"
          aria-label="Volver a la carta"
          className="flex size-10 items-center justify-center border border-neutral-300"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl">QR de la carta</h1>
          <p className="text-xs text-neutral-600">
            Uno por mesa. Imprime, recorta y pégalos. Es la única carta con
            precios: la de la web va sin ellos.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4">
        {signs.map((sign) => (
          <div
            key={sign.key}
            className="flex break-inside-avoid flex-col items-center border border-neutral-400 p-4 text-center"
          >
            <p className="text-sm uppercase tracking-[0.18em] text-neutral-600">
              {settings.barName}
            </p>
            <p className="font-display text-2xl">La carta</p>

            {/* eslint-disable-next-line @next/next/no-img-element --
                es un data URL generado en el servidor: no hay nada que
                optimizar ni ningún origen remoto que declarar. */}
            <img
              src={qr}
              alt="Código QR de la carta con precios"
              width={200}
              height={200}
              className="mt-3 size-[200px]"
            />

            <p className="mt-3 text-sm font-medium">
              Escanea y mira la carta con precios
            </p>
            <p className="mt-1 text-xs text-neutral-600">
              {sign.label ?? "Pega este código en la mesa"}
              {sign.hint ? ` · ${sign.hint}` : ""}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 px-4 pb-8 print:hidden">
        <p className="flex items-center gap-2 text-xs text-neutral-600">
          <Printer className="size-4" aria-hidden />
          Imprime esta página desde el navegador (Ctrl/Cmd + P).
        </p>
        <p className="text-xs text-neutral-600">
          Los códigos apuntan a{" "}
          <span className="font-medium">{absoluteUrl("/carta/mesa")}</span>. Si
          cambia la dirección del sitio, vuelve a imprimirlos.
        </p>
      </div>
    </div>
  );
}
