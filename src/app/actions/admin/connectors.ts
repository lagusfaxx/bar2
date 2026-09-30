"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { recordAudit } from "./audit";

/** Desconectar un conector: su llave deja de servir en la siguiente llamada. */
export async function revokeConnection(tokenId: string) {
  const admin = await requireAdmin();

  const token = await prisma.oAuthToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date() },
    select: { client: { select: { name: true } } },
  });

  await recordAudit(
    admin.userId,
    "delete",
    "OAuthToken",
    tokenId,
    `Conector desconectado: ${token.client.name}`,
  );

  revalidatePath("/admin/conectores");
}
