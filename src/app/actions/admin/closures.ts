"use server";

import { requireCmsUser } from "@/lib/auth";
import { revalidateContent } from "@/lib/cache";
import { formError, formSuccess, type FormState } from "@/lib/form-state";
import { prisma } from "@/lib/prisma";
import { closedDaySchema, fieldErrors } from "@/lib/validation";

import { recordAudit } from "./audit";

/** Dias en que el local no abre al publico (evento privado, vacaciones). */

/**
 * El dia elegido, tal como se entiende en el local.
 *
 * El campo es de tipo `date` y guarda un dia sin hora, pero Postgres lo lee
 * como medianoche UTC. Si se construyera con la zona del servidor —que en el
 * contenedor es UTC— un cierre cargado desde Chile podria terminar guardado el
 * dia anterior. Se arma el mediodia UTC, que cae dentro del mismo dia en
 * cualquier zona horaria del mundo, y asi la fecha que se escribe es la que se
 * guarda.
 */
function parseDay(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) throw new Error("Fecha inválida");

  const [, year, month, day] = match.map(Number) as number[];
  return new Date(Date.UTC(year!, month! - 1, day!, 12, 0, 0));
}

export async function saveClosedDay(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireCmsUser();

  const parsed = closedDaySchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa el día que quieres cerrar.", fieldErrors(parsed.error));
  }

  const { date, reason, note } = parsed.data;

  let day: Date;
  try {
    day = parseDay(date);
  } catch {
    return formError("Esa fecha no es válida.", { date: "Indica un día" });
  }

  const existente = await prisma.closedDay.findUnique({
    where: { date: day },
    select: { id: true },
  });

  if (existente) {
    return formError("Ese día ya está marcado como cerrado.", {
      date: "Ya estaba cerrado",
    });
  }

  const saved = await prisma.closedDay.create({
    data: {
      date: day,
      reason: reason || "Evento privado",
      note: note || null,
      createdById: session.userId,
    },
  });

  await recordAudit(session.userId, "create", "ClosedDay", saved.id, `Cerrado: ${date}`);

  revalidateContent("events");

  return formSuccess("Día marcado como cerrado.");
}

export async function deleteClosedDay(id: string) {
  const session = await requireCmsUser();

  const removed = await prisma.closedDay.delete({ where: { id } });

  await recordAudit(
    session.userId,
    "delete",
    "ClosedDay",
    id,
    `Reabierto: ${removed.date.toISOString().slice(0, 10)}`,
  );

  revalidateContent("events");
}
