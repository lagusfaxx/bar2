"use server";

import { revalidatePath } from "next/cache";

import { requireCmsUser } from "@/lib/auth";
import { formError, formSuccess, type FormState } from "@/lib/form-state";
import { prisma } from "@/lib/prisma";
import { fieldErrors, posTableSchema } from "@/lib/validation";

import { recordAudit } from "./audit";

/** Alta y baja de mesas del salon. */

function refresh() {
  revalidatePath("/admin/mesas");
  revalidatePath("/staff/pos");
}

export async function saveTable(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireCmsUser();

  const parsed = posTableSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa los datos de la mesa.", fieldErrors(parsed.error));
  }

  const { id, number, name, zone, seats, active } = parsed.data;

  const repetida = await prisma.posTable.findUnique({
    where: { number },
    select: { id: true },
  });

  if (repetida && repetida.id !== id) {
    return formError(`Ya existe la mesa ${number}.`, {
      number: "Número repetido",
    });
  }

  const data = {
    number,
    name: name || null,
    zone: zone || null,
    seats,
    active,
  };

  if (id) {
    await prisma.posTable.update({ where: { id }, data });
  } else {
    const last = await prisma.posTable.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
    });

    await prisma.posTable.create({
      data: { ...data, position: (last?.position ?? -1) + 1 },
    });
  }

  await recordAudit(
    session.userId,
    id ? "update" : "create",
    "PosTable",
    id ?? undefined,
    `Mesa ${number}`,
  );

  refresh();
  return formSuccess(`Mesa ${number} guardada.`);
}

/**
 * Crea de una vez las mesas que falten hasta un numero dado.
 *
 * Cargar veinte mesas de a una es tedioso y es lo primero que hay que hacer
 * para que el POS sirva de algo. Las que ya existen no se tocan.
 */
export async function createTableRange(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireCmsUser();

  const hasta = Number(formData.get("upTo"));

  if (!Number.isInteger(hasta) || hasta < 1 || hasta > 200) {
    return formError("Indica hasta qué número crear (entre 1 y 200).", {
      upTo: "Número inválido",
    });
  }

  const existentes = await prisma.posTable.findMany({
    select: { number: true },
  });

  const ocupados = new Set(existentes.map((table) => table.number));
  const faltantes = [];

  for (let number = 1; number <= hasta; number++) {
    if (!ocupados.has(number)) faltantes.push(number);
  }

  if (faltantes.length === 0) {
    return formSuccess("Ya estaban todas creadas.");
  }

  await prisma.posTable.createMany({
    data: faltantes.map((number, index) => ({
      number,
      position: existentes.length + index,
    })),
  });

  await recordAudit(
    session.userId,
    "create",
    "PosTable",
    undefined,
    `${faltantes.length} mesas creadas`,
  );

  refresh();
  return formSuccess(`${faltantes.length} mesa(s) creada(s).`);
}

export async function deleteTable(id: string): Promise<FormState> {
  const session = await requireCmsUser();

  const table = await prisma.posTable.findUnique({
    where: { id },
    include: { _count: { select: { sessions: true } } },
  });

  if (!table) return formError("Esa mesa ya no está.");

  // Una mesa con historial no se borra: se desactiva. Borrarla se llevaria
  // por delante las cuentas de todas las noches que paso por ahi.
  if (table._count.sessions > 0) {
    await prisma.posTable.update({ where: { id }, data: { active: false } });

    await recordAudit(
      session.userId,
      "update",
      "PosTable",
      id,
      `Mesa ${table.number} desactivada`,
    );

    refresh();
    return formSuccess(
      `Mesa ${table.number} desactivada. Su historial de cuentas se conserva.`,
    );
  }

  await prisma.posTable.delete({ where: { id } });
  await recordAudit(session.userId, "delete", "PosTable", id, `Mesa ${table.number}`);

  refresh();
  return formSuccess(`Mesa ${table.number} eliminada.`);
}
