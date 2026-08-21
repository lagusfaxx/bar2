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
 * El cartel de cada mesa: un solo QR.
 *
 * Antes esta hoja repetia el mismo codigo en todos los carteles —llevaba a
 * /carta/mesa a secas, igual para todo el salon— y al lado, en otra hoja
 * distinta, salian los del karaoke, uno por mesa. Dos pegatinas sobre la misma
 * mesa: dos cosas que se despegan, se manchan y se pegan torcidas, y un
 * cliente que tiene que elegir cual escanear antes de saber que hay detras de
 * cada una.
 *
 * Ahora es uno solo por mesa y lleva su numero puesto: abre la carta con
 * precios y, cuando el karaoke esta abierto, deja pedir cancion desde ahi sin
 * que nadie tenga que buscarse en una lista de mesas.
 *
 * Sin mesas cargadas en el panel se imprime igual, con el codigo sin numero:
 * abre la misma carta y sirve para salir del paso.
 *
 * Vive fuera del grupo (panel): la hoja es para papel —fondo blanco, tinta
 * negra— y la barra lateral del panel solo gastaria toner.
 */
export default async function MenuQrPage() {
  const user = await getPanelSession();

  if (!user) redirect("/admin/login?volver=/admin/carta/qr");

  const [tables, settings] = await Promise.all([
    prisma.posTable.findMany({
      where: { active: true },
      orderBy: [{ position: "asc" }, { number: "asc" }],
      select: { id: true, number: true, name: true, zone: true },
    }),
    getSettings(),
  ]);

  /*
   * Un codigo por mesa, porque ahora cada uno lleva su numero.
   *
   * Sin mesas cargadas igual sirve: se imprime una tanda de carteles con el
   * codigo sin numero —abre la misma carta— y se pegan donde haga falta.
   */
  const signs = await Promise.all(
    tables.length > 0
      ? tables.map(async (table) => ({
          key: table.id,
          label: `Mesa ${table.number}`,
          hint: table.name ?? table.zone,
          qr: await menuQrDataUrl(table.number),
        }))
      : Array.from({ length: DEFAULT_COPIES }, async (_, index) => ({
          key: `sin-mesa-${index}`,
          label: null,
          hint: null,
          qr: await menuQrDataUrl(),
        })),
  );

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
          <h1 className="font-display text-xl">QR de las mesas</h1>
          <p className="text-xs text-neutral-600">
            Uno por mesa, y es el único que va pegado: abre la carta con precios
            y lleva el número de mesa puesto para el karaoke. Imprime, recorta y
            pégalos.
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

            {/* El numero, grande: es lo que el garzon lee de lejos para saber
                que cartel va en que mesa al momento de pegarlos, y lo que el
                cliente dice en voz alta cuando pide. */}
            <p className="font-display text-3xl">{sign.label ?? "La carta"}</p>

            {/* eslint-disable-next-line @next/next/no-img-element --
                es un data URL generado en el servidor: no hay nada que
                optimizar ni ningún origen remoto que declarar. */}
            <img
              src={sign.qr}
              alt={
                sign.label
                  ? `Código QR de la carta para la ${sign.label.toLowerCase()}`
                  : "Código QR de la carta con precios"
              }
              width={200}
              height={200}
              className="mt-3 size-[200px]"
            />

            <p className="mt-3 text-sm font-medium">
              Escanea y mira la carta con precios
            </p>
            <p className="mt-1 text-xs text-neutral-600">
              {sign.hint ?? "Y pide karaoke desde tu mesa"}
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
          <span className="font-medium">{absoluteUrl("/carta/mesa")}</span> con
          el número de cada mesa. Si cambia la dirección del sitio, o si
          renumeras las mesas, vuelve a imprimirlos.
        </p>
        <p className="text-xs text-neutral-600">
          Este cartel reemplaza al del karaoke: el mismo código abre la carta y
          deja pedir canción desde la mesa. No hace falta pegar dos.
        </p>
      </div>
    </div>
  );
}
