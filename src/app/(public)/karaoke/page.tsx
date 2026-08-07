import { Mic } from "lucide-react";
import type { Metadata } from "next";

import { KaraokeRequestForm } from "@/components/site/karaoke-request";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { getSettings } from "@/lib/content";
import { getKaraokeBoard, searchCatalog } from "@/lib/karaoke";
import { absoluteUrl } from "@/lib/utils";

/** La cola y el interruptor cambian durante la noche: nada de caché. */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const description = `Pide tu canción de karaoke desde tu mesa en ${settings.barName}.`;

  return {
    title: "Karaoke",
    description,
    alternates: { canonical: absoluteUrl("/karaoke") },
    // No es una pagina para buscar en Google: se llega escaneando el codigo de
    // la mesa, y fuera del local no sirve de nada.
    robots: { index: false, follow: false },
    openGraph: { title: `Karaoke · ${settings.barName}`, description },
  };
}

/**
 * La pagina del QR de la mesa.
 *
 * Muestra la cola en vivo —saber cuantos van adelante es la mitad de lo que
 * viene a preguntar la gente— y el formulario para pedir. Cuando el karaoke
 * esta cerrado no oculta nada: lo dice, para que nadie se quede esperando un
 * turno que no existe.
 */
export default async function KaraokePublicPage({
  searchParams,
}: {
  searchParams: Promise<{ mesa?: string }>;
}) {
  const [{ mesa }, board, popular] = await Promise.all([
    searchParams,
    getKaraokeBoard(),
    searchCatalog("", 8),
  ]);

  const tableNumber = Number.parseInt(mesa ?? "", 10);

  return (
    <>
      <PageHeader
        eyebrow="Karaoke"
        title="Pide tu canción"
        lead={
          board.open
            ? "Elige de la lista del local o escribe la tuya. Te llamamos por el micrófono cuando llegue tu turno."
            : "Esta noche no hay karaoke."
        }
      />

      <Section>
        <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            {board.open ? (
              <KaraokeRequestForm
                tableNumber={Number.isNaN(tableNumber) ? null : tableNumber}
                popular={popular}
              />
            ) : (
              <div className="card-bz p-8 text-center">
                <Mic className="mx-auto size-10 text-crimson-bright" aria-hidden />
                <p className="mt-4 font-display text-2xl text-bone">
                  El karaoke está cerrado
                </p>
                <p className="mt-2 text-sm text-muted">
                  Cuando arranque, este mismo código te va a dejar pedir tu
                  canción. Mientras tanto, pregúntale al equipo por la
                  cartelera de la semana.
                </p>
              </div>
            )}
          </div>

          {/* La cola, en vivo: es lo que la gente mira para calcular si le da
              el tiempo antes de irse. */}
          <aside className="flex flex-col gap-6">
            <div className="card-bz p-6">
              <h2 className="font-display text-lg text-bone">Cantando ahora</h2>

              {board.singing ? (
                <>
                  <p className="mt-2 text-2xl text-bone">
                    {board.singing.singer}
                  </p>
                  {board.singing.track && (
                    <p className="mt-1 text-sm text-muted">
                      {board.singing.track.title}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  Nadie con el micrófono en este momento.
                </p>
              )}
            </div>

            <div className="card-bz p-6">
              <h2 className="font-display text-lg text-bone">
                Ya están esperando
                {board.queue.length > 0 && ` · ${board.queue.length}`}
              </h2>

              {board.queue.length === 0 ? (
                <p className="mt-2 text-sm text-muted">
                  Nadie en la cola. Si pides ahora, cantas enseguida.
                </p>
              ) : (
                <ol className="mt-3 flex flex-col gap-2">
                  {board.queue.slice(0, 8).map((entry, index) => (
                    <li
                      key={entry.id}
                      className="flex items-baseline gap-3 text-sm"
                    >
                      <span className="font-display text-muted">
                        {index + 1}
                      </span>
                      <span className="text-bone-dim">{entry.singer}</span>
                      <span className="ml-auto truncate text-xs text-muted">
                        {entry.track?.title ?? entry.requestText}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}
