import { Mic } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { MenuCatalog } from "@/components/menu/menu-catalog";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { getMenu, getSettings } from "@/lib/content";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();

  return {
    title: "Carta de la mesa",
    description: `La carta con precios de ${settings.barName}.`,
    // Fuera de Google y del resto de buscadores: a esta carta se llega por el
    // QR de la mesa, no por una busqueda. Sin canonical ni Open Graph, que son
    // justamente las señales que la harian circular.
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: { index: false, follow: false, noimageindex: true },
    },
  };
}

/**
 * La carta con precios, la del QR de las mesas.
 *
 * Es la misma carta de /carta —las mismas categorias, fotos y descripciones,
 * cargadas una sola vez en el panel— pero con el precio de cada producto y las
 * promos vigentes. Vive en una URL aparte, sin enlaces desde el sitio, fuera
 * del sitemap y bloqueada en robots.txt: quien esta en la mesa la abre con la
 * camara, y quien mira la web desde afuera no la encuentra.
 *
 * No es un secreto criptografico —una URL corta se puede teclear— sino la
 * misma discrecion de una carta impresa: esta sobre la mesa, no en la vitrina.
 *
 * El QR de la mesa trae ademas su numero (`?mesa=`), y por eso esta pagina es
 * tambien la puerta del karaoke: antes eran dos pegatinas distintas sobre la
 * misma mesa y el cliente tenia que elegir cual escanear sin saber que habia
 * detras de cada una. Con el numero ya puesto, pedir una cancion es un toque y
 * no hay que buscarse a uno mismo en una lista de mesas.
 *
 * Sin numero la pagina no cambia: es la carta, y nada mas. Es lo que pasa con
 * los carteles impresos antes de cargar las mesas en el panel.
 */
export default async function CartaMesaPage({
  searchParams,
}: {
  searchParams: Promise<{ mesa?: string }>;
}) {
  const [{ mesa }, menu, settings] = await Promise.all([
    searchParams,
    getMenu(),
    getSettings(),
  ]);

  /* El numero viene de un QR impreso, asi que puede llegar en cualquier
     estado: recortado, tecleado a mano o directamente ausente. Si no es un
     numero, la pagina sigue siendo la carta de siempre. */
  const parsed = Number.parseInt(mesa ?? "", 10);
  const tableNumber = Number.isFinite(parsed) && parsed > 0 ? parsed : null;

  return (
    <>
      <PageHeader
        eyebrow={tableNumber ? `Mesa ${tableNumber}` : "Carta de la mesa"}
        title="Lo que hay esta noche"
        lead={
          tableNumber
            ? `La carta completa con precios. Cuando elijas, avísale al equipo de sala: estás en la mesa ${tableNumber}.`
            : "La carta completa con precios. Cuando elijas, avísale al equipo de sala y lo anotamos en tu mesa."
        }
        image={menu[0]?.imageUrl ?? "/demo/category-1.jpg"}
      />

      {/*
        El karaoke, en el mismo codigo.

        Solo cuando esta abierto: un acceso a algo que esta cerrado es una
        promesa que la pagina no puede cumplir, y el cliente termina en una
        pantalla que le dice que no. Y solo con el numero de mesa a mano, que
        es lo unico que este enlace aporta sobre entrar por el menu del sitio.
      */}
      {tableNumber && settings.karaokeOpen && (
        <Section className="container-bz">
          <Link
            href={`/karaoke?mesa=${tableNumber}`}
            className="card-bz flex items-center gap-4 p-6 transition-colors hover:border-crimson"
          >
            <Mic className="size-8 shrink-0 text-crimson-bright" aria-hidden />
            <span>
              <span className="block font-display text-xl text-bone">
                Esta noche hay karaoke
              </span>
              <span className="mt-1 block text-sm text-muted">
                Pide tu canción desde la mesa {tableNumber}, sin hacer fila.
              </span>
            </span>
          </Link>
        </Section>
      )}

      {menu.length === 0 ? (
        <Section className="container-bz">
          <p className="card-bz p-12 text-center text-muted">
            Estamos actualizando la carta. Pídele la carta al equipo de sala.
          </p>
        </Section>
      ) : (
        <>
          <MenuCatalog menu={menu} showPrices />

          <div className="container-bz pb-24">
            <p className="border-t border-line pt-8 text-xs text-muted-dark">
              Los precios están expresados en pesos chilenos e incluyen
              impuestos. La carta puede variar según disponibilidad.
            </p>
          </div>
        </>
      )}
    </>
  );
}
