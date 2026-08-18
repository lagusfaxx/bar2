import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

import { deleteCampaign } from "@/app/actions/admin/campaigns";
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
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Campañas de correo" };

const ESTADO = {
  DRAFT: { label: "Borrador", tone: "muted" as const },
  SENDING: { label: "Enviando…", tone: "gilt" as const },
  SENT: { label: "Enviada", tone: "default" as const },
  FAILED: { label: "Falló", tone: "crimson" as const },
};

export default async function AdminCampanasPage() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <AdminHeader
        title="Campañas de correo"
        description="Novedades y promociones a los socios de la tarjeta."
        action={
          <ButtonLink href="/admin/campanas/nueva">
            <Plus className="size-4" aria-hidden />
            Nueva campaña
          </ButtonLink>
        }
      />

      <Panel>
        {campaigns.length === 0 ? (
          <EmptyState
            title="Todavía no hay campañas"
            description="Escribe la primera y mándate una prueba antes de enviarla a los socios."
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Campaña</Th>
                  <Th>Estado</Th>
                  <Th>Llegó a</Th>
                  <Th>Fecha</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => {
                  const estado = ESTADO[campaign.status];

                  return (
                    <tr key={campaign.id}>
                      <Td>
                        <Link
                          href={`/admin/campanas/${campaign.id}`}
                          className="text-bone hover:text-crimson-bright"
                        >
                          {campaign.name}
                        </Link>
                        <span className="mt-0.5 block text-xs text-muted">
                          {campaign.subject}
                        </span>
                      </Td>
                      <Td>
                        <Badge tone={estado.tone}>{estado.label}</Badge>
                      </Td>
                      <Td>
                        {campaign.status === "SENT" || campaign.status === "FAILED" ? (
                          <span className="text-sm text-bone-dim">
                            {campaign.sentCount} de {campaign.totalCount}
                            {campaign.failedCount > 0 && (
                              <span className="ml-1 text-crimson-bright">
                                · {campaign.failedCount} fallaron
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-dark">—</span>
                        )}
                      </Td>
                      <Td>
                        <span className="text-sm text-muted">
                          {formatDate(campaign.sentAt ?? campaign.createdAt)}
                        </span>
                      </Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/admin/campanas/${campaign.id}`}
                            aria-label={`Abrir ${campaign.name}`}
                            className="flex size-9 items-center justify-center border border-line text-muted transition-colors hover:border-crimson hover:text-bone"
                          >
                            <Pencil className="size-4" aria-hidden />
                          </Link>

                          <ActionButton
                            action={deleteCampaign.bind(null, campaign.id)}
                            confirm={`¿Eliminar «${campaign.name}»? El registro de a quién le llegó se conserva.`}
                            aria-label={`Eliminar ${campaign.name}`}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </ActionButton>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Panel>
    </>
  );
}
