import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

import { deletePromotion, togglePromotion } from "@/app/actions/admin/content";
import { ActionButton } from "@/components/admin/action-button";
import {
  AdminHeader,
  EmptyState,
  Panel,
  Table,
  TableWrap,
  Td,
  Th,
} from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/section";
import { formatDate, promotionValueLabel, TIER_LABELS } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Promociones" };

export default async function AdminPromocionesPage() {
  const promotions = await prisma.promotion.findMany({
    orderBy: { position: "asc" },
    include: { _count: { select: { redemptions: true } } },
  });

  return (
    <>
      <AdminHeader
        title="Promociones"
        description="Los beneficios que los socios pueden pedir en el local mostrando su BarzuCard."
        action={
          <ButtonLink href="/admin/promociones/nueva" size="sm">
            <Plus className="size-4" aria-hidden />
            Nueva promoción
          </ButtonLink>
        }
      />

      <Panel>
        {promotions.length === 0 ? (
          <EmptyState
            title="Todavía no hay promociones"
            description="Crea el primer beneficio para que los socios tengan algo que canjear."
            action={
              <ButtonLink href="/admin/promociones/nueva" size="sm">
                <Plus className="size-4" aria-hidden />
                Crear promoción
              </ButtonLink>
            }
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Promoción</Th>
                  <Th className="hidden md:table-cell">Beneficio</Th>
                  <Th className="hidden lg:table-cell">Reglas</Th>
                  <Th className="hidden lg:table-cell">Vigencia</Th>
                  <Th>Canjes</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((promotion) => (
                  <tr key={promotion.id} className="group">
                    <Td>
                      <Link href={`/admin/promociones/${promotion.id}`} className="block max-w-xs">
                        <span className="block truncate text-sm text-bone transition-colors group-hover:text-crimson-bright">
                          {promotion.title}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          <Badge tone={promotion.active ? "free" : "muted"}>
                            {promotion.active ? "Activa" : "Pausada"}
                          </Badge>
                          {promotion.minTier !== "CLASICA" && (
                            <Badge tone="gilt">{TIER_LABELS[promotion.minTier]}</Badge>
                          )}
                        </span>
                      </Link>
                    </Td>

                    <Td className="hidden whitespace-nowrap text-sm text-crimson-bright md:table-cell">
                      {promotionValueLabel(promotion.type, promotion.value)}
                    </Td>

                    <Td className="hidden text-xs text-muted lg:table-cell">
                      {promotion.maxPerCard === 0
                        ? "Usos ilimitados"
                        : `${promotion.maxPerCard} uso${promotion.maxPerCard === 1 ? "" : "s"} por tarjeta`}
                      {promotion.maxTotal > 0 && ` · cupo ${promotion.maxTotal}`}
                      {promotion.pointsCost > 0 && ` · ${promotion.pointsCost} pts`}
                    </Td>

                    <Td className="hidden whitespace-nowrap text-xs text-muted lg:table-cell">
                      {formatDate(promotion.startsAt, { month: "short" })}
                      {promotion.endsAt
                        ? ` – ${formatDate(promotion.endsAt, { month: "short" })}`
                        : " – sin vencimiento"}
                    </Td>

                    <Td className="text-sm text-bone-dim tabular-nums">
                      {promotion._count.redemptions}
                    </Td>

                    <Td>
                      <div className="flex items-center justify-end gap-1.5">
                        <ActionButton
                          action={async () => {
                            "use server";
                            await togglePromotion(promotion.id, !promotion.active);
                          }}
                          title={promotion.active ? "Pausar" : "Activar"}
                          aria-label={promotion.active ? "Pausar" : "Activar"}
                        >
                          {promotion.active ? (
                            <EyeOff className="size-4" aria-hidden />
                          ) : (
                            <Eye className="size-4" aria-hidden />
                          )}
                        </ActionButton>

                        <Link
                          href={`/admin/promociones/${promotion.id}`}
                          title="Editar"
                          aria-label={`Editar ${promotion.title}`}
                          className="inline-flex size-9 items-center justify-center border border-line text-muted transition-colors hover:border-crimson hover:text-crimson-bright"
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Link>

                        <ActionButton
                          variant="danger"
                          confirm={`¿Eliminar "${promotion.title}"? Se borran también sus ${promotion._count.redemptions} canjes registrados.`}
                          action={async () => {
                            "use server";
                            await deletePromotion(promotion.id);
                          }}
                          title="Eliminar"
                          aria-label={`Eliminar ${promotion.title}`}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </ActionButton>
                      </div>
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
