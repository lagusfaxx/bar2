import {
  AdminHeader,
  EmptyState,
  Panel,
  StatCard,
  Table,
  TableWrap,
  Td,
  Th,
} from "@/components/admin/ui";
import { Badge } from "@/components/ui/section";
import { formatCardNumber, formatDateTime, promotionValueLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Canjes" };

export default async function AdminCanjesPage() {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [redemptions, total, lastMonth, topPromotions] = await Promise.all([
    prisma.redemption.findMany({
      orderBy: { redeemedAt: "desc" },
      take: 200,
      include: {
        promotion: { select: { title: true, type: true, value: true } },
        card: {
          select: {
            cardNumber: true,
            member: { select: { fullName: true, email: true } },
          },
        },
        staffUser: { select: { name: true } },
      },
    }),
    prisma.redemption.count(),
    prisma.redemption.count({ where: { redeemedAt: { gte: since } } }),
    prisma.redemption.groupBy({
      by: ["promotionId"],
      _count: { promotionId: true },
      orderBy: { _count: { promotionId: "desc" } },
      take: 1,
    }),
  ]);

  const topPromotion = topPromotions[0]
    ? await prisma.promotion.findUnique({
        where: { id: topPromotions[0].promotionId },
        select: { title: true },
      })
    : null;

  return (
    <>
      <AdminHeader
        title="Canjes de BarzuCard"
        description="Historial de beneficios entregados en el local."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Canjes totales" value={total} tone="gilt" />
        <StatCard label="Últimos 30 días" value={lastMonth} tone="crimson" />
        <StatCard
          label="Promoción más canjeada"
          value={
            <span className="text-lg leading-snug">
              {topPromotion?.title ?? "—"}
            </span>
          }
          hint={
            topPromotions[0]
              ? `${topPromotions[0]._count.promotionId} canjes`
              : undefined
          }
        />
      </div>

      <Panel>
        {redemptions.length === 0 ? (
          <EmptyState
            title="Todavía no hay canjes"
            description="Cuando el equipo de sala valide una BarzuCard, el movimiento queda registrado aquí."
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Promoción</Th>
                  <Th className="hidden md:table-cell">Socio</Th>
                  <Th className="hidden lg:table-cell">Tarjeta</Th>
                  <Th className="hidden lg:table-cell">Validó</Th>
                  <Th>Comprobante</Th>
                </tr>
              </thead>
              <tbody>
                {redemptions.map((redemption) => (
                  <tr key={redemption.id}>
                    <Td className="whitespace-nowrap text-xs text-muted">
                      {formatDateTime(redemption.redeemedAt)}
                    </Td>

                    <Td>
                      <span className="block max-w-56 truncate text-sm text-bone">
                        {redemption.promotion.title}
                      </span>
                      <span className="mt-1 block">
                        <Badge tone="crimson">
                          {promotionValueLabel(
                            redemption.promotion.type,
                            redemption.promotion.value,
                          )}
                        </Badge>
                      </span>
                    </Td>

                    <Td className="hidden md:table-cell">
                      <span className="block max-w-48 truncate text-sm text-bone-dim">
                        {redemption.card.member.fullName}
                      </span>
                      <span className="block max-w-48 truncate text-xs text-muted-dark">
                        {redemption.card.member.email}
                      </span>
                    </Td>

                    <Td className="hidden font-mono text-xs whitespace-nowrap text-muted lg:table-cell">
                      {formatCardNumber(redemption.card.cardNumber)}
                    </Td>

                    <Td className="hidden text-xs text-muted lg:table-cell">
                      {redemption.staffUser?.name ?? "—"}
                    </Td>

                    <Td className="font-mono text-xs whitespace-nowrap text-gilt-soft">
                      {redemption.receiptCode}
                      {(redemption.pointsEarned > 0 || redemption.pointsSpent > 0) && (
                        <span className="mt-1 block text-[0.6rem] text-muted-dark">
                          {redemption.pointsSpent > 0 && `−${redemption.pointsSpent} pts `}
                          {redemption.pointsEarned > 0 && `+${redemption.pointsEarned} pts`}
                        </span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Panel>
    </>
  );
}
