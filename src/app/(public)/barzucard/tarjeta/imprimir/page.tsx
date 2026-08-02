import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CardVisual } from "@/components/barzucard/card-visual";
import { getMemberSession } from "@/lib/auth";
import { getSettings } from "@/lib/content";
import { formatCardNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { cardQrDataUrl } from "@/lib/qr";

export const metadata: Metadata = {
  title: "Imprimir mi BarzuCard",
  robots: { index: false, follow: false },
};

/**
 * Vista pensada para imprimir la tarjeta en tamaño real (85,6 × 54 mm, el
 * mismo de una tarjeta bancaria). Se imprimen el frente y el dorso, listos para
 * recortar y plastificar.
 */
export default async function ImprimirTarjetaPage() {
  const session = await getMemberSession();

  if (!session) redirect("/barzucard/ingresar?volver=/barzucard/tarjeta/imprimir");

  const [member, settings] = await Promise.all([
    prisma.member.findUnique({
      where: { id: session.memberId },
      include: { card: true },
    }),
    getSettings(),
  ]);

  if (!member?.card) redirect("/barzucard/tarjeta");

  const card = member.card;
  const qrDataUrl = await cardQrDataUrl(card.qrToken);

  return (
    <main className="container-bz py-28 sm:py-32">
      <div className="print-hidden mb-10">
        <Link
          href="/barzucard/tarjeta"
          className="text-sm text-muted transition-colors hover:text-crimson-bright"
        >
          ← Volver a mi tarjeta
        </Link>

        <h1 className="mt-5 font-display text-3xl text-bone">
          Imprimir tu BarzuCard
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Imprime esta página en tamaño real (sin ajuste de escala) sobre papel
          grueso o cartulina. Recorta por el borde y, si quieres que dure,
          plastificala. El QR sigue funcionando impreso.
        </p>

        <p className="mt-4 text-xs text-muted-dark">
          Consejo: en el diálogo de impresión, desactiva &ldquo;Ajustar a la
          página&rdquo; y activa &ldquo;Gráficos de fondo&rdquo;.
        </p>
      </div>

      {/* 85,6 mm es el ancho estándar de una tarjeta. */}
      <div className="flex flex-col gap-8 print:gap-4">
        <div className="w-[85.6mm]">
          <CardVisual
            cardNumber={card.cardNumber}
            holder={member.fullName}
            tier={card.tier}
            points={card.points}
            qrDataUrl={qrDataUrl}
            issuedAt={card.issuedAt}
            status={card.status}
          />
        </div>

        {/* Dorso */}
        <div className="print-card flex aspect-[1.586/1] w-[85.6mm] flex-col justify-between rounded-2xl border border-line bg-ink p-4">
          <div>
            <p className="font-western text-sm text-crimson">
              BAR<span className="text-bone">Z</span>UO
            </p>
            <p className="mt-0.5 text-[0.45rem] tracking-[0.2em] text-muted uppercase">
              {settings.address} · {settings.addressCity}
            </p>
          </div>

          <p className="text-[0.42rem] leading-relaxed text-muted-dark">
            Tarjeta personal e intransferible. Preséntala en el local para
            canjear los beneficios vigentes según sus condiciones. No es
            canjeable por dinero. BARZUO puede suspenderla ante un uso indebido.
            Consulta los términos en {settings.email ?? "el sitio web"}.
          </p>

          <p className="font-mono text-[0.55rem] tracking-[0.14em] text-bone-dim">
            {formatCardNumber(card.cardNumber)}
          </p>
        </div>
      </div>
    </main>
  );
}
