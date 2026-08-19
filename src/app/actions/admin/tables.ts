"use server";

import { revalidatePath } from "next/cache";

import { requireCmsUser } from "@/lib/auth";
import { formError, formSuccess, type FormState } from "@/lib/form-state";
import { prisma } from "@/lib/prisma";
import { fieldErrors, posTableSchema, posZoneSchema } from "@/lib/validation";

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

  const { id, number, name, zoneId, seats, active } = parsed.data;

  const repetida = await prisma.posTable.findUnique({
    where: { number },
    select: { id: true },
  });

  if (repetida && repetida.id !== id) {
    return formError(`Ya existe la mesa ${number}.`, {
      number: "Número repetido",
    });
  }

  // Una zona que se borro entremedio no puede dejar la mesa sin guardar: se
  // guarda igual, suelta, y quien administra la vuelve a asignar.
  const zona = zoneId
    ? await prisma.posZone.findUnique({ where: { id: zoneId }, select: { id: true } })
    : null;

  const data = {
    number,
    name: name || null,
    zoneId: zona?.id ?? null,
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

// --- Zonas del salon ---------------------------------------------------------

/**
 * Alta y edicion de zonas.
 *
 * Una zona es una parte del salon —"Salón", "Terraza", "Barra"— y sirve para
 * dos cosas distintas: que el mapa de sala se lea por secciones en vez de ser
 * treinta casillas iguales, y que un garzon pueda mirar solo la suya.
 */
export async function saveZone(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireCmsUser();

  const parsed = posZoneSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa los datos de la zona.", fieldErrors(parsed.error));
  }

  const { id, name, color, active } = parsed.data;

  const repetida = await prisma.posZone.findUnique({
    where: { name },
    select: { id: true },
  });

  if (repetida && repetida.id !== id) {
    return formError(`Ya existe la zona "${name}".`, { name: "Nombre repetido" });
  }

  const data = { name, color: color || null, active };

  if (id) {
    await prisma.posZone.update({ where: { id }, data });
  } else {
    const last = await prisma.posZone.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
    });

    await prisma.posZone.create({
      data: { ...data, position: (last?.position ?? -1) + 1 },
    });
  }

  await recordAudit(
    session.userId,
    id ? "update" : "create",
    "PosZone",
    id ?? undefined,
    `Zona ${name}`,
  );

  refresh();
  return formSuccess(`Zona "${name}" guardada.`);
}

/**
 * Borra una zona.
 *
 * Las mesas que estaban en ella no se tocan: quedan sueltas, arriba de todo en
 * el mapa, hasta que se les asigne otra. Perder una zona no puede significar
 * perder mesas del salon.
 */
export async function deleteZone(id: string): Promise<FormState> {
  const session = await requireCmsUser();

  const zone = await prisma.posZone.findUnique({
    where: { id },
    select: { name: true, _count: { select: { tables: true } } },
  });

  if (!zone) return formError("Esa zona ya no está.");

  await prisma.posZone.delete({ where: { id } });

  await recordAudit(session.userId, "delete", "PosZone", id, `Zona ${zone.name}`);

  refresh();
  return formSuccess(
    zone._count.tables > 0
      ? `Zona "${zone.name}" eliminada. Sus ${zone._count.tables} mesa(s) quedaron sin zona.`
      : `Zona "${zone.name}" eliminada.`,
  );
}

/** Sube o baja una zona en el mapa de sala. */
export async function moveZone(id: string, direction: "up" | "down"): Promise<FormState> {
  await requireCmsUser();

  const zones = await prisma.posZone.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, position: true },
  });

  const index = zones.findIndex((zone) => zone.id === id);
  if (index === -1) return formError("Esa zona ya no está.");

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= zones.length) return formSuccess("Ya estaba ahí.");

  // Se reescriben todas las posiciones: las heredadas del texto libre pueden
  // venir repetidas, y ahi intercambiar dos numeros iguales no mueve nada.
  const ordenadas = [...zones];
  [ordenadas[index], ordenadas[target]] = [ordenadas[target], ordenadas[index]];

  await prisma.$transaction(
    ordenadas.map((zone, position) =>
      prisma.posZone.update({ where: { id: zone.id }, data: { position } }),
    ),
  );

  refresh();
  return formSuccess("Zonas reordenadas.");
}
