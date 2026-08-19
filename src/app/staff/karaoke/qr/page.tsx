import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getPanelSession } from "@/lib/auth";
import { getKaraokeTables } from "@/lib/karaoke";
import { karaokeQrDataUrl } from "@/lib/qr";
import { getSettings } from "@/lib/content";

export const dynamic = "force-dynamic";

export const metadata = { title: "Karaoke · Códigos de las mesas" };

/**
 * Los QR para pegar en las mesas.
 *
 * Se imprime una vez por temporada y se recorta. Cada codigo lleva el numero
 * de su mesa puesto, asi que el cliente que lo escanea no tiene que elegirla
 * de una lista —y sala sabe desde donde vino el pedido sin preguntar—.
 *
 * La hoja esta pensada para papel: fondo blanco y tinta negra, sin el tema
 * oscuro del resto del panel, que en una impresora seria un derroche de toner
 * y un QR que no lee.
 */
export default async function KaraokeQrPage() {
  const user = await getPanelSession();

  if (!user) redirect("/staff/login?volver=/staff/karaoke/qr");

  const [tables, settings] = await Promise.all([
    getKaraokeTables(),
    getSettings(),
  ]);

  const codes = await Promise.all(
    tables.map(async (table) => ({
      ...table,
      qr: await karaokeQrDataUrl(table.number),
    })),
  );

  return (
    <div className="min-h-[100dvh] bg-white text-black">
      {/* La barra no se imprime: en el papel solo van los códigos. */}
      <header className="flex items-center gap-3 border-b border-neutral-300 px-4 py-3 print:hidden">
        <Link
          href="/staff/karaoke"
          aria-label="Volver al karaoke"
          className="flex size-10 items-center justify-center border border-neutral-300"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl">Códigos de karaoke</h1>
          <p className="text-xs text-neutral-600">
            Uno por mesa. Imprime, recorta y pégalos en cada mesa.
          </p>
        </div>
      </header>

      {codes.length === 0 ? (
        <p className="p-6 text-sm text-neutral-600">
          No hay mesas cargadas. Créalas en el panel, en <strong>Sala →
          Mesas</strong>.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4">
          {codes.map((table) => (
            <div
              key={table.id}
              className="flex break-inside-avoid flex-col items-center border border-neutral-400 p-4 text-center"
            >
              <p className="text-sm uppercase tracking-[0.18em] text-neutral-600">
                {settings.barName} · Karaoke
              </p>
              <p className="font-display text-3xl">Mesa {table.number}</p>

              {/* eslint-disable-next-line @next/next/no-img-element --
                  es un data URL generado en el servidor: no hay nada que
                  optimizar ni ningún origen remoto que declarar. */}
              <img
                src={table.qr}
                alt={`Código QR del karaoke para la mesa ${table.number}`}
                width={200}
                height={200}
                className="mt-3 size-[200px]"
              />

              <p className="mt-3 text-sm font-medium">
                Escanea y pide tu canción
              </p>
              <p className="mt-1 text-xs text-neutral-600">
                {table.name ?? table.zone?.name ?? "Te llamamos por el micrófono"}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 pb-8 print:hidden">
        <p className="flex items-center gap-2 text-xs text-neutral-600">
          <Printer className="size-4" aria-hidden />
          Imprime esta página desde el navegador (Ctrl/Cmd + P).
        </p>
      </div>
    </div>
  );
}
