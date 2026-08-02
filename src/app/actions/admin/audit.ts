import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Registra un cambio del panel. Es informativo: si falla, no debe tumbar la
 * operación que el administrador acaba de hacer.
 */
export async function recordAudit(
  userId: string | null,
  action: "create" | "update" | "delete" | "login" | "redeem",
  entity: string,
  entityId?: string,
  summary?: string,
) {
  try {
    await prisma.auditLog.create({
      data: { userId, action, entity, entityId, summary },
    });
  } catch {
    // El historial es secundario frente al cambio de contenido.
  }
}

export function listAudit(take = 12) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { name: true } } },
  });
}
