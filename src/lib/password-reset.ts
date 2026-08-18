import "server-only";

import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";

/**
 * Los enlaces para volver a entrar.
 *
 * Vive aparte de las acciones a proposito. En un archivo "use server" cada
 * cosa exportada queda publicada como accion que cualquiera puede invocar
 * desde afuera, y comprobar un token es una consulta interna que hace la
 * pagina: no tiene por que existir tambien como endpoint suelto.
 */

/** Cuanto dura el enlace. Corto: es una llave de la cuenta viajando por correo. */
export const RESET_TTL_HORAS = 2;

/**
 * El token viaja en el correo; en la base solo queda su huella.
 *
 * Quien consiga leer la tabla no puede entrar a ninguna cuenta con lo que hay
 * ahi. El token en claro existe una sola vez, dentro del correo del socio.
 */
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Un enlace sirve si existe, no se uso y no vencio. */
export async function findValidReset(token: string) {
  const reset = await prisma.passwordReset.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      usedAt: true,
      expiresAt: true,
      member: { select: { id: true, fullName: true } },
    },
  });

  if (!reset || reset.usedAt || reset.expiresAt < new Date()) return null;

  return reset;
}
