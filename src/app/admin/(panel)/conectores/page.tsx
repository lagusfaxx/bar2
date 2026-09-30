import { Unplug } from "lucide-react";
import { redirect } from "next/navigation";

import { revokeConnection } from "@/app/actions/admin/connectors";
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
import { getPanelSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { mcpResource } from "@/lib/oauth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = { title: "Conectores" };

/**
 * Las aplicaciones con acceso a los informes de ventas (Claude y compania).
 *
 * Se conectan solas desde Claude; aca se ve quien las autorizo, cuando se
 * usaron por ultima vez y se desconectan.
 */
export default async function ConnectorsPage() {
  const session = await getPanelSession();
  if (session?.role !== "ADMIN") redirect("/admin");

  const tokens = await prisma.oAuthToken.findMany({
    where: { revokedAt: null, refreshExpiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      lastUsedAt: true,
      client: { select: { name: true } },
      user: { select: { name: true } },
    },
  });

  return (
    <>
      <AdminHeader
        title="Conectores"
        description="Aplicaciones con acceso de solo lectura a los informes de ventas, como Claude. Desconectar una corta su acceso en el acto."
      />

      <Panel
        title="Conectar Claude"
        description="En Claude: Ajustes → Conectores → Agregar conector personalizado, con esta URL. Claude te traerá de vuelta aquí para autorizar."
        className="mb-8"
      >
        <div className="px-5 py-4 sm:px-6">
          <code className="block break-all border border-line bg-ink px-4 py-3 text-sm text-bone">
            {mcpResource()}
          </code>
        </div>
      </Panel>

      {tokens.length === 0 ? (
        <EmptyState
          title="Nada conectado"
          description="Cuando autorices a Claude aparecerá aquí."
        />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Aplicación</Th>
                <Th>Autorizó</Th>
                <Th>Conectado</Th>
                <Th>Último uso</Th>
                <Th className="text-right">Desconectar</Th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr key={token.id}>
                  <Td className="text-bone">{token.client.name}</Td>
                  <Td>{token.user.name}</Td>
                  <Td>{formatDateTime(token.createdAt)}</Td>
                  <Td>{token.lastUsedAt ? formatDateTime(token.lastUsedAt) : "Nunca"}</Td>
                  <Td>
                    <div className="flex justify-end">
                      <ActionButton
                        action={revokeConnection.bind(null, token.id)}
                        confirm={`¿Desconectar «${token.client.name}»? Tendrá que volver a pedir permiso.`}
                        aria-label={`Desconectar ${token.client.name}`}
                        variant="danger"
                      >
                        <Unplug className="size-4" aria-hidden />
                      </ActionButton>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
