import { Ban, CheckCircle2, Printer, RefreshCw } from "lucide-react";

import {
  regenerateCardQr,
  setCardStatus,
  markCardPrinted,
} from "@/app/actions/admin/loyalty";
import { ActionButton } from "@/components/admin/action-button";
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
import { formatCardNumber, formatDate, TIER_LABELS } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Socios y tarjetas" };

export default async function AdminTarjetasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const [members, total, active, suspended] = await Promise.all([
    prisma.member.findMany({
      where: query
        ? {
            OR: [
              { fullName: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { card: { cardNumber: { contains: query.replace(/\D/g, "") } } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 150,
      include: {
        card: { include: { _count: { select: { redemptions: true } } } },
      },
    }),
    prisma.member.count(),
    prisma.barzuCard.count({ where: { status: "ACTIVE" } }),
    prisma.barzuCard.count({ where: { status: "SUSPENDED" } }),
  ]);

  return (
    <>
      <AdminHeader
        title="Socios y tarjetas"
        description="Todas las BarzuCard emitidas, con su nivel, puntos y estado."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Socios registrados" value={total} tone="gilt" />
        <StatCard label="Tarjetas activas" value={active} />
        <StatCard label="Suspendidas" value={suspended} tone={suspended > 0 ? "crimson" : "default"} />
      </div>

      <Panel>
        <form method="get" className="mb-5 flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Buscar por nombre, email o número de tarjeta"
            className="w-full border border-line bg-ink px-4 py-3 text-sm text-bone placeholder:text-muted-dark focus:border-crimson focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 border border-line px-5 text-[0.65rem] font-medium tracking-[0.16em] text-bone-dim uppercase transition-colors hover:border-crimson hover:text-bone"
          >
            Buscar
          </button>
        </form>

        {members.length === 0 ? (
          <EmptyState
            title={query ? "Sin resultados" : "Todavía no hay socios"}
            description={
              query
                ? "Prueba con otro nombre, email o número de tarjeta."
                : "Cuando alguien se registre en la web, su BarzuCard aparece acá."
            }
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Socio</Th>
                  <Th className="hidden md:table-cell">Tarjeta</Th>
                  <Th>Nivel</Th>
                  <Th className="hidden lg:table-cell">Puntos</Th>
                  <Th className="hidden lg:table-cell">Canjes</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <Td>
                      <span className="block max-w-56 truncate text-sm text-bone">
                        {member.fullName}
                      </span>
                      <span className="block max-w-56 truncate text-xs text-muted">
                        {member.email}
                      </span>
                      <span className="block text-xs text-muted-dark">
                        Desde {formatDate(member.createdAt, { month: "short" })}
                      </span>
                    </Td>

                    <Td className="hidden font-mono text-xs whitespace-nowrap text-bone-dim md:table-cell">
                      {member.card ? formatCardNumber(member.card.cardNumber) : "—"}
                      {member.card?.printedAt && (
                        <span className="mt-1 block text-[0.6rem] text-muted-dark">
                          Impresa {formatDate(member.card.printedAt, { month: "short" })}
                        </span>
                      )}
                    </Td>

                    <Td>
                      {member.card ? (
                        <Badge tone={member.card.tier === "CLASICA" ? "muted" : "gilt"}>
                          {TIER_LABELS[member.card.tier]}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </Td>

                    <Td className="hidden text-sm text-bone-dim tabular-nums lg:table-cell">
                      {member.card?.points ?? 0}
                    </Td>

                    <Td className="hidden text-sm text-muted tabular-nums lg:table-cell">
                      {member.card?._count.redemptions ?? 0}
                    </Td>

                    <Td>
                      {member.card ? (
                        <Badge tone={member.card.status === "ACTIVE" ? "free" : "crimson"}>
                          {member.card.status === "ACTIVE" ? "Activa" : "Suspendida"}
                        </Badge>
                      ) : (
                        <Badge tone="muted">Sin tarjeta</Badge>
                      )}
                    </Td>

                    <Td>
                      {member.card && (
                        <div className="flex items-center justify-end gap-1.5">
                          <ActionButton
                            action={async () => {
                              "use server";
                              await setCardStatus(
                                member.card!.id,
                                member.card!.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                              );
                            }}
                            title={
                              member.card.status === "ACTIVE"
                                ? "Suspender tarjeta"
                                : "Reactivar tarjeta"
                            }
                            aria-label={
                              member.card.status === "ACTIVE"
                                ? "Suspender tarjeta"
                                : "Reactivar tarjeta"
                            }
                            variant={member.card.status === "ACTIVE" ? "danger" : "ghost"}
                          >
                            {member.card.status === "ACTIVE" ? (
                              <Ban className="size-4" aria-hidden />
                            ) : (
                              <CheckCircle2 className="size-4" aria-hidden />
                            )}
                          </ActionButton>

                          <ActionButton
                            action={async () => {
                              "use server";
                              await markCardPrinted(member.card!.id);
                            }}
                            title="Marcar como impresa"
                            aria-label="Marcar tarjeta como impresa"
                          >
                            <Printer className="size-4" aria-hidden />
                          </ActionButton>

                          <ActionButton
                            confirm="Al regenerar el QR, la tarjeta física anterior deja de funcionar. ¿Continuar?"
                            action={async () => {
                              "use server";
                              await regenerateCardQr(member.card!.id);
                            }}
                            title="Regenerar QR"
                            aria-label="Regenerar código QR"
                          >
                            <RefreshCw className="size-4" aria-hidden />
                          </ActionButton>
                        </div>
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
