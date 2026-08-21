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
 * Los QR de karaoke, sueltos.
 *
 * Ya no es la hoja que se pega en las mesas: para eso esta la de
 * /admin/carta/qr, donde cada mesa lleva un solo codigo que abre la carta y
 * ademas trae su numero puesto para el karaoke. Dos pegatinas sobre la misma
 * mesa eran dos cosas que se despegan y se manchan, y obligaban al cliente a
 * elegir cual escanear antes de saber que habia detras de cada una.
 *
 * Esta queda para lo que no es una mesa: el cartel de la barra, el de la
 * entrada, la noche de karaoke en un salon prestado. Cada codigo sigue
 * llevando el numero de su mesa, asi que quien lo escanea no tiene que
 * elegirla de una lista.
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
            Para las mesas no hace falta esta hoja: el{" "}
            <Link href="/admin/carta/qr" className="underline">
              QR de las mesas
            </Link>{" "}
            ya abre la carta y deja pedir canción con el número puesto. Esta
            sirve para carteles sueltos —la barra, la entrada, un salón
            prestado—.
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
                {table.name ?? table.zone ?? "Te llamamos por el micrófono"}
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
