import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/prisma";

import type { CampaignAudience } from "@/generated/prisma/enums";

/**
 * Email marketing.
 *
 * Lo delicado de mandar a toda la base no es el envio: es a quien se le manda,
 * y como se sale de la lista. Las dos cosas viven aca.
 */

/**
 * El enlace para darse de baja.
 *
 * Se firma con la clave del sitio en vez de guardar un token por socio. Asi no
 * hay tabla que mantener ni token que caduque, y el enlace sigue funcionando
 * dentro de un correo que alguien abre seis meses despues — que es justamente
 * cuando la gente se da de baja.
 *
 * Lleva el id firmado y no el correo: un enlace filtrado no revela la direccion
 * de nadie, y nadie puede dar de baja a un tercero cambiando un parametro.
 */
function secret() {
  const value = process.env.AUTH_SECRET;

  if (!value || value.length < 32) {
    throw new Error("AUTH_SECRET no esta configurada.");
  }

  return value;
}

export function unsubscribeToken(memberId: string) {
  const firma = createHmac("sha256", secret())
    .update(`baja:${memberId}`)
    .digest("hex")
    .slice(0, 32);

  return `${memberId}.${firma}`;
}

/** Devuelve el socio si la firma cuadra, y null si no. */
export function verifyUnsubscribeToken(token: string): string | null {
  const corte = token.lastIndexOf(".");
  if (corte < 1) return null;

  const memberId = token.slice(0, corte);
  const firma = token.slice(corte + 1);
  const esperada = unsubscribeToken(memberId).split(".")[1] ?? "";

  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);

  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return memberId;
}

/**
 * A quien le llega una campana.
 *
 * `SUSCRITOS` es el unico destino legitimo para una promocion, y es el que
 * viene por defecto. `TODOS` existe para avisos de servicio —un cambio de
 * horario, el local cerrado por un feriado— y no para vender: mandarle
 * publicidad a quien dijo que no la queria es lo que hace que el dominio entero
 * termine marcado como no deseado, y con el se cae tambien el correo de las
 * tarjetas y el de recuperar la cuenta.
 */
export async function campaignRecipients(audience: CampaignAudience) {
  if (audience === "PRUEBA") return [];

  return prisma.member.findMany({
    where: {
      card: { status: "ACTIVE" },
      ...(audience === "SUSCRITOS" ? { acceptsNews: true } : {}),
    },
    select: { id: true, email: true, fullName: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Reemplaza lo que la campana puede personalizar.
 *
 * Son dos marcas y no un lenguaje de plantillas a proposito: quien escribe la
 * campana es el administrador del bar, no un programador, y una marca mal
 * escrita en un correo que ya salio no se puede corregir.
 */
export function renderCampaignBody(html: string, nombre: string) {
  const primerNombre = nombre.split(" ")[0] ?? nombre;

  return html
    .replaceAll("{{nombre}}", primerNombre)
    .replaceAll("{{nombre_completo}}", nombre);
}
