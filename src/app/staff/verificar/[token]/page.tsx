import { ArrowLeft, LogOut } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { logoutPanel } from "@/app/actions/auth";
import { Logo } from "@/components/brand/logo";
import { CardVerifier } from "@/components/staff/card-verifier";
import type { CardLookup } from "@/app/actions/admin/loyalty";
import { getPanelSession } from "@/lib/auth";
import { checkEligibility } from "@/lib/barzucard";
import { getSettings } from "@/lib/content";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Destino del QR impreso en la tarjeta.
 *
 * Escanear con la cámara nativa del teléfono abre directamente esta pantalla
 * con el socio ya resuelto — es el camino más rápido en la barra y funciona en
 * cualquier sistema, incluso donde el navegador no puede leer códigos.
 */
export default async function VerificarTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [{ token }, session] = await Promise.all([params, getPanelSession()]);

  if (!session) {
    redirect(`/staff/login?volver=/staff/verificar/${encodeURIComponent(token)}`);
  }

  const [settings, card] = await Promise.all([
    getSettings(),
    prisma.barzuCard.findUnique({
      where: { qrToken: token },
      include: {
        member: { select: { fullName: true, email: true } },
        redemptions: {
          orderBy: { redeemedAt: "desc" },
          take: 5,
          include: { promotion: { select: { title: true } } },
        },
      },
    }),
  ]);

  let lookup: CardLookup | undefined;

  if (card) {
    const now = new Date();

    const [promotions, usage] = await Promise.all([
      prisma.promotion.findMany({
        where: {
          active: true,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        },
        orderBy: { position: "asc" },
        include: {
          product: { select: { name: true } },
          category: { select: { name: true } },
        },
      }),
      prisma.redemption.groupBy({
        by: ["promotionId"],
        where: { cardId: card.id, voidedAt: null },
        _count: { promotionId: true },
      }),
    ]);

    const usageByPromotion = new Map(
      usage.map((entry) => [entry.promotionId, entry._count.promotionId]),
    );

    lookup = {
      card: {
        id: card.id,
        cardNumber: card.cardNumber,
        status: card.status,
      },
      member: card.member,
      promotions: promotions.map((promotion) => {
        const used = usageByPromotion.get(promotion.id) ?? 0;
        const eligibility = checkEligibility({
          promotion,
          card: { status: card.status },
          redemptionsForThisPromotion: used,
          now,
        });

        return {
          id: promotion.id,
          title: promotion.title,
          description: promotion.description,
          terms: promotion.terms,
          type: promotion.type,
          value: promotion.value,
          scopeLabel:
            promotion.scope === "PRODUCTO"
              ? "Producto"
              : promotion.scope === "CATEGORIA"
                ? "Categoría"
                : "Toda la cuenta",
          targetName:
            promotion.product?.name ?? promotion.category?.name ?? null,
          used,
          maxPerCard: promotion.maxPerCard,
          eligible: eligibility.ok,
          reason: eligibility.ok ? undefined : eligibility.reason,
        };
      }),
      lastRedemptions: card.redemptions.map((redemption) => ({
        id: redemption.id,
        title: redemption.promotion.title,
        redeemedAt: redemption.redeemedAt.toISOString(),
        receiptCode: redemption.receiptCode,
      })),
    };
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-4 px-4 py-3">
          <Link
            href="/staff"
            aria-label="Volver a la verificación"
            className="flex size-10 items-center justify-center border border-line text-muted transition-colors hover:border-crimson hover:text-crimson-bright"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>

          <Logo src={settings.logoUrl} name={settings.barName} variant="compact" />

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
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
        {card ? (
          <CardVerifier initial={lookup} />
        ) : (
          <div className="border border-crimson/50 bg-crimson/10 p-6">
            <p className="font-display text-xl text-crimson-bright">
              Tarjeta no encontrada
            </p>
            <p className="mt-2 text-sm text-muted">
              Este código QR no corresponde a ninguna BarzuCard activa. Puede
              haber sido regenerado desde el panel.
            </p>
            <Link
              href="/staff"
              className="mt-5 inline-block text-sm text-crimson-bright underline-offset-4 hover:underline"
            >
              Buscar por número de tarjeta
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
