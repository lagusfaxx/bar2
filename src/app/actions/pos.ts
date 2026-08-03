"use server";

import { revalidatePath } from "next/cache";

import type { Station } from "@/generated/prisma/enums";
import { requireStaff } from "@/lib/auth";
import { formError, formSuccess, type FormState } from "@/lib/form-state";
import {
  generatePaymentCode,
  generateSessionCode,
  lineTotal,
  pointsForSpend,
  priceFor,
  stationFor,
} from "@/lib/pos";
import { prisma } from "@/lib/prisma";
import { tierForPoints } from "@/lib/barzucard";
import { fieldErrors, posDinerSchema, posItemSchema, posOpenTableSchema, posPaymentSchema } from "@/lib/validation";

/**
 * Operacion de sala.
 *
 * Todas las acciones exigen sesion del panel: cualquier rol sirve, porque el
 * garzon es rol STAFF. Las lecturas viven en `lib/pos.ts`.
 */

/** El garzon esta parado en la mesa: refrescamos las dos pantallas que mira. */
function refresh(sessionId?: string) {
  revalidatePath("/staff/pos");
  if (sessionId) revalidatePath(`/staff/pos/${sessionId}`);
}

// --- Mesa --------------------------------------------------------------------

export async function openTable(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireStaff();

  const parsed = posOpenTableSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa los datos de la mesa.", fieldErrors(parsed.error));
  }

  const { tableId, guests, note } = parsed.data;

  const table = await prisma.posTable.findUnique({
    where: { id: tableId },
    select: { id: true, number: true, active: true },
  });

  if (!table || !table.active) return formError("Esa mesa no está disponible.");

  // Una mesa con turno abierto no puede abrir otro: seria la misma gente
  // repartida en dos cuentas que nadie sabria juntar.
  const abierta = await prisma.tableSession.findFirst({
    where: { tableId, status: "OPEN" },
    select: { id: true },
  });

  if (abierta) {
    return formSuccess("La mesa ya estaba abierta.", { sessionId: abierta.id });
  }

  const session = await prisma.tableSession.create({
    data: {
      tableId,
      code: generateSessionCode(table.number),
      guests,
      note: note || null,
      openedById: user.userId,
    },
    select: { id: true },
  });

  refresh(session.id);
  return formSuccess(`Mesa ${table.number} abierta.`, { sessionId: session.id });
}

export async function closeTable(sessionId: string): Promise<FormState> {
  await requireStaff();

  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    include: {
      items: {
        where: { status: { not: "CANCELLED" }, paymentId: null },
        select: { id: true },
      },
    },
  });

  if (!session) return formError("La mesa no existe.");
  if (session.status === "CLOSED") return formSuccess("La mesa ya estaba cerrada.");

  // Cerrar con consumo sin cobrar es como perder la cuenta: se bloquea.
  if (session.items.length > 0) {
    return formError(
      `Quedan ${session.items.length} producto(s) sin cobrar. Cobra o anula antes de cerrar.`,
    );
  }

  await prisma.tableSession.update({
    where: { id: sessionId },
    data: { status: "CLOSED", closedAt: new Date() },
  });

  refresh(sessionId);
  return formSuccess("Mesa cerrada.");
}

// --- Comensales --------------------------------------------------------------

export async function addDiner(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = posDinerSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Describe al comensal.", fieldErrors(parsed.error));
  }

  const { sessionId, label, color } = parsed.data;

  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    select: { status: true, _count: { select: { diners: true } } },
  });

  if (!session) return formError("La mesa no existe.");
  if (session.status === "CLOSED") return formError("La mesa está cerrada.");

  await prisma.diner.create({
    data: {
      sessionId,
      label,
      color: color || null,
      position: session._count.diners,
    },
  });

  refresh(sessionId);
  return formSuccess(`${label} agregado.`);
}

export async function removeDiner(dinerId: string): Promise<FormState> {
  await requireStaff();

  const diner = await prisma.diner.findUnique({
    where: { id: dinerId },
    include: { items: { select: { id: true } } },
  });

  if (!diner) return formError("Ese comensal ya no está.");

  // Sus consumos no se borran: pasan a la cuenta de la mesa, que es donde
  // terminan igual cuando alguien se cambia de silla.
  await prisma.$transaction([
    prisma.orderItem.updateMany({
      where: { dinerId },
      data: { dinerId: null },
    }),
    prisma.diner.delete({ where: { id: dinerId } }),
  ]);

  refresh(diner.sessionId);
  return formSuccess(
    diner.items.length > 0
      ? `${diner.label} eliminado. Su consumo pasó a la mesa.`
      : `${diner.label} eliminado.`,
  );
}

// --- Productos ---------------------------------------------------------------

export async function addItem(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireStaff();

  const parsed = posItemSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa el producto.", fieldErrors(parsed.error));
  }

  const { sessionId, productId, dinerId, quantity, note } = parsed.data;

  const [session, product] = await Promise.all([
    prisma.tableSession.findUnique({
      where: { id: sessionId },
      select: { status: true },
    }),
    prisma.menuProduct.findUnique({
      where: { id: productId },
      include: { category: { select: { station: true } } },
    }),
  ]);

  if (!session) return formError("La mesa no existe.");
  if (session.status === "CLOSED") return formError("La mesa está cerrada.");
  if (!product) return formError("Ese producto ya no está en la carta.");
  if (!product.available) return formError(`${product.name} está agotado.`);

  const priced = priceFor(product);

  await prisma.orderItem.create({
    data: {
      sessionId,
      dinerId: dinerId || null,
      productId: product.id,
      // Copia del producto: la carta puede cambiar durante el servicio.
      name: product.name,
      unitPriceCents: priced.unitPriceCents,
      discountCents: priced.discountCents,
      discountLabel: priced.discountLabel,
      quantity,
      note: note || null,
      station: stationFor(product),
      createdById: user.userId,
    },
  });

  refresh(sessionId);
  return formSuccess(`${quantity} × ${product.name}`);
}

export async function setItemQuantity(
  itemId: string,
  quantity: number,
): Promise<FormState> {
  await requireStaff();

  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    select: { id: true, sessionId: true, status: true, paymentId: true },
  });

  if (!item) return formError("Esa línea ya no está.");
  if (item.paymentId) return formError("Esa línea ya se cobró.");

  // Ya comandada: la cocina la esta preparando, cambiar la cantidad en
  // silencio dejaria la comanda impresa mintiendo.
  if (item.status !== "DRAFT") {
    return formError("Ya salió en una comanda. Anúlala y vuelve a pedirla.");
  }

  if (quantity < 1) {
    await prisma.orderItem.delete({ where: { id: itemId } });
    refresh(item.sessionId);
    return formSuccess("Producto quitado.");
  }

  await prisma.orderItem.update({
    where: { id: itemId },
    data: { quantity: Math.min(quantity, 99) },
  });

  refresh(item.sessionId);
  return formSuccess("Cantidad actualizada.");
}

export async function moveItem(
  itemId: string,
  dinerId: string | null,
): Promise<FormState> {
  await requireStaff();

  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    select: { sessionId: true, paymentId: true },
  });

  if (!item) return formError("Esa línea ya no está.");
  if (item.paymentId) return formError("Esa línea ya se cobró.");

  await prisma.orderItem.update({
    where: { id: itemId },
    data: { dinerId },
  });

  refresh(item.sessionId);
  return formSuccess("Producto reasignado.");
}

/** Anula una linea ya comandada (se equivocaron, el cliente la rechazo). */
export async function cancelItem(itemId: string): Promise<FormState> {
  const user = await requireStaff();

  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    select: { sessionId: true, paymentId: true, name: true },
  });

  if (!item) return formError("Esa línea ya no está.");
  if (item.paymentId) return formError("Esa línea ya se cobró.");

  await prisma.orderItem.update({
    where: { id: itemId },
    data: { status: "CANCELLED", createdById: user.userId },
  });

  refresh(item.sessionId);
  return formSuccess(`${item.name} anulado.`);
}

// --- Comanda -----------------------------------------------------------------

/**
 * Manda a imprimir lo cargado.
 *
 * Se arma una comanda por estacion: la cocina no necesita saber que se pidio
 * un gin tonic. Quedan en cola (PENDING) y el agente del local las retira.
 */
export async function sendOrder(sessionId: string): Promise<FormState> {
  const user = await requireStaff();

  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    include: {
      table: { select: { number: true } },
      items: { where: { status: "DRAFT" }, select: { id: true, station: true } },
    },
  });

  if (!session) return formError("La mesa no existe.");
  if (session.status === "CLOSED") return formError("La mesa está cerrada.");
  if (session.items.length === 0) return formError("No hay nada nuevo que mandar.");

  const porEstacion = new Map<Station, string[]>();

  for (const item of session.items) {
    const lista = porEstacion.get(item.station) ?? [];
    lista.push(item.id);
    porEstacion.set(item.station, lista);
  }

  const creadas = await prisma.$transaction(async (tx) => {
    // Correlativo del dia: el numero que se canta en la cocina.
    const inicioDelDia = new Date();
    inicioDelDia.setHours(0, 0, 0, 0);

    const ultima = await tx.orderTicket.findFirst({
      where: { createdAt: { gte: inicioDelDia } },
      orderBy: { number: "desc" },
      select: { number: true },
    });

    let numero = (ultima?.number ?? 0) + 1;
    const resultado: Array<{ station: Station; number: number }> = [];

    for (const [station, itemIds] of porEstacion) {
      const ticket = await tx.orderTicket.create({
        data: {
          sessionId,
          number: numero,
          station,
          createdById: user.userId,
        },
        select: { id: true },
      });

      await tx.orderItem.updateMany({
        where: { id: { in: itemIds } },
        data: { status: "SENT", ticketId: ticket.id },
      });

      resultado.push({ station, number: numero });
      numero += 1;
    }

    return resultado;
  });

  refresh(sessionId);

  const detalle = creadas
    .map((ticket) => `${ticket.station === "BARRA" ? "barra" : "cocina"} #${ticket.number}`)
    .join(" y ");

  return formSuccess(`Comanda enviada a ${detalle}.`);
}

/** Vuelve a encolar una comanda que la impresora no pudo sacar. */
export async function reprintTicket(ticketId: string): Promise<FormState> {
  await requireStaff();

  const ticket = await prisma.orderTicket.findUnique({
    where: { id: ticketId },
    select: { sessionId: true, number: true },
  });

  if (!ticket) return formError("Esa comanda ya no está.");

  await prisma.orderTicket.update({
    where: { id: ticketId },
    data: { status: "PENDING", attempts: 0, lastError: null },
  });

  refresh(ticket.sessionId);
  return formSuccess(`Comanda #${ticket.number} reenviada.`);
}

// --- Cobro -------------------------------------------------------------------

/**
 * Cobra una cuenta.
 *
 * Con comensal cobra solo lo suyo y la mesa sigue viva; sin comensal cobra
 * todo lo pendiente. Que alguien cierre y despues siga pidiendo es normal: se
 * le hara otro cobro con las lineas nuevas.
 */
export async function payAccount(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireStaff();

  const parsed = posPaymentSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa el cobro.", fieldErrors(parsed.error));
  }

  const { sessionId, dinerId, method, cardNumber } = parsed.data;

  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true },
  });

  if (!session) return formError("La mesa no existe.");

  // Solo lo que falta pagar de esa cuenta. Si es un comensal, lo suyo; si no,
  // todo lo pendiente de la mesa (incluido lo compartido).
  const items = await prisma.orderItem.findMany({
    where: {
      sessionId,
      status: { not: "CANCELLED" },
      paymentId: null,
      ...(dinerId ? { dinerId } : {}),
    },
    select: {
      id: true,
      unitPriceCents: true,
      discountCents: true,
      quantity: true,
    },
  });

  if (items.length === 0) return formError("No hay nada pendiente de cobro.");

  const subtotalCents = items.reduce(
    (total, item) => total + item.unitPriceCents * item.quantity,
    0,
  );
  const discountCents = items.reduce(
    (total, item) => total + item.discountCents * item.quantity,
    0,
  );
  const totalCents = items.reduce((total, item) => total + lineTotal(item), 0);

  // BarzuCard presentada al pagar: se guarda en el cobro. Es el enganche para
  // sumar puntos por consumo sin pedirle nada mas al garzon.
  let cardId: string | null = null;
  let puntos = 0;

  if (cardNumber) {
    const digits = cardNumber.replace(/\D/g, "");

    const card = await prisma.barzuCard.findFirst({
      where: { cardNumber: digits, status: "ACTIVE" },
      select: { id: true, points: true },
    });

    if (!card) return formError("Esa BarzuCard no existe o está suspendida.");

    cardId = card.id;
    puntos = pointsForSpend(totalCents);
  }

  const code = generatePaymentCode();

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        sessionId,
        dinerId: dinerId || null,
        code,
        subtotalCents,
        discountCents,
        totalCents,
        method,
        cardId,
        cashierId: user.userId,
      },
      select: { id: true },
    });

    await tx.orderItem.updateMany({
      where: { id: { in: items.map((item) => item.id) } },
      data: { paymentId: payment.id },
    });

    if (cardId && puntos > 0) {
      const card = await tx.barzuCard.findUniqueOrThrow({
        where: { id: cardId },
        select: { points: true },
      });

      const points = card.points + puntos;

      await tx.barzuCard.update({
        where: { id: cardId },
        data: { points, tier: tierForPoints(points) },
      });
    }
  });

  refresh(sessionId);

  return formSuccess(
    puntos > 0 ? `Cobrado · ${code} · +${puntos} puntos` : `Cobrado · ${code}`,
    { code, totalCents, points: puntos },
  );
}
