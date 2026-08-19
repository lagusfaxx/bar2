"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import type { Station } from "@/generated/prisma/enums";
import { requireStaff } from "@/lib/auth";
import { formError, formSuccess, type FormState } from "@/lib/form-state";
import {
  generatePaymentCode,
  generateSessionCode,
  lineTotal,
  priceFor,
  stationFor,
} from "@/lib/pos";
import { prisma } from "@/lib/prisma";
import {
  checkEligibility,
  generateReceiptCode,
  normalizeCardInput,
} from "@/lib/barzucard";
import { resolvePromotion } from "@/lib/promotions";
import {
  fieldErrors,
  posCardSchema,
  posDinerSchema,
  posItemSchema,
  posOpenTableSchema,
  posPaymentSchema,
  posPromotionSchema,
  posSessionTagSchema,
  posSessionWaiterSchema,
} from "@/lib/validation";

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
      // Quien la abre es quien la atiende, hasta que alguien diga lo
      // contrario. Preguntarlo al abrir seria un paso de mas para contestar
      // lo que ya se sabe: el telefono que abre la mesa es el del garzon que
      // esta parado en ella.
      attendedById: user.userId,
    },
    select: { id: true },
  });

  refresh(session.id);
  return formSuccess(`Mesa ${table.number} abierta.`, { sessionId: session.id });
}

/**
 * Quien atiende la mesa.
 *
 * Cambia varias veces en una noche —entra un turno, el que abrio la mesa esta
 * en la caja, alguien cubre un descanso— y hasta ahora la sala solo sabia
 * quien la habia abierto. Cualquiera del personal puede reasignarla: en un
 * bar lleno, pedirle permiso a un jefe para decir que la 7 ahora la lleva
 * Anais no lo hace nadie.
 *
 * Con `userId` vacio la mesa queda sin garzon a cargo, que es lo que
 * corresponde cuando el que la atendia se fue y todavia no la tomo nadie.
 */
export async function setSessionWaiter(
  sessionId: string,
  userId: string | null,
): Promise<FormState> {
  await requireStaff();

  const parsed = posSessionWaiterSchema.safeParse({
    sessionId,
    userId: userId ?? "",
  });

  if (!parsed.success) return formError("No se pudo asignar la mesa.");

  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    select: { status: true, table: { select: { number: true } } },
  });

  if (!session) return formError("La mesa no existe.");
  if (session.status === "CLOSED") return formError("La mesa ya está cerrada.");

  const waiterId = parsed.data.userId || null;

  if (waiterId) {
    const waiter = await prisma.user.findUnique({
      where: { id: waiterId },
      select: { name: true, active: true },
    });

    if (!waiter || !waiter.active) {
      return formError("Esa persona ya no atiende mesas.");
    }

    await prisma.tableSession.update({
      where: { id: sessionId },
      data: { attendedById: waiterId },
    });

    refresh(sessionId);
    return formSuccess(`Mesa ${session.table.number}: atiende ${waiter.name}.`);
  }

  await prisma.tableSession.update({
    where: { id: sessionId },
    data: { attendedById: null },
  });

  refresh(sessionId);
  return formSuccess(`Mesa ${session.table.number} sin garzón asignado.`);
}

/**
 * La etiqueta de la mesa.
 *
 * Una palabra que cambia como se atiende esa mesa y que hoy solo vive en la
 * cabeza del que la abrio: que es un cumpleaños, que esta reservada, que se
 * van a las diez. Escrita en la casilla la ve toda la sala.
 *
 * Con la etiqueta vacia se saca.
 */
export async function setSessionTag(
  sessionId: string,
  tag: string,
  color: string,
): Promise<FormState> {
  await requireStaff();

  const parsed = posSessionTagSchema.safeParse({ sessionId, tag, color });

  if (!parsed.success) {
    return formError("La etiqueta es de hasta 24 caracteres.");
  }

  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    select: { status: true },
  });

  if (!session) return formError("La mesa no existe.");
  if (session.status === "CLOSED") return formError("La mesa ya está cerrada.");

  const etiqueta = parsed.data.tag || null;

  await prisma.tableSession.update({
    where: { id: sessionId },
    data: {
      tag: etiqueta,
      // Sin etiqueta no hay color que guardar: dejarlo seria pintar algo que
      // ya no esta.
      tagColor: etiqueta ? parsed.data.color || null : null,
    },
  });

  refresh(sessionId);
  return formSuccess(etiqueta ? `Mesa marcada: ${etiqueta}.` : "Etiqueta quitada.");
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

  await prisma.$transaction([
    prisma.tableSession.update({
      where: { id: sessionId },
      data: { status: "CLOSED", closedAt: new Date() },
    }),
    /*
     * Nada de esta mesa sigue esperando en cocina.
     *
     * La pantalla de la estacion ya no se limpia sola —nadie la toca— asi que
     * una comanda que el garzon olvido marcar se quedaria ahi toda la noche,
     * envejeciendo en rojo, de una mesa que ya se fue. Cerrar la mesa es la
     * prueba de que no queda nada por entregar.
     */
    prisma.orderTicket.updateMany({
      where: { sessionId, kind: "COMANDA", prep: "PENDIENTE" },
      data: { prep: "RETIRADA", pickedUpAt: new Date() },
    }),
  ]);

  refresh(sessionId);
  revalidatePath("/staff/cocina");
  revalidatePath("/staff/barra");

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

  const created = await prisma.orderItem.create({
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
    select: { id: true },
  });

  refresh(sessionId);

  // Se devuelve la linea recien creada para poder ofrecer "agregar nota" sin
  // tener que buscarla en la cuenta.
  return formSuccess(`${quantity} × ${product.name}`, {
    itemId: created.id,
    name: product.name,
  });
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

/**
 * Pone o cambia la nota de una linea ("sin lechuga", "bien cocido").
 *
 * Se admite tambien sobre una linea ya comandada: si la cocina todavia no la
 * empezo, cambiar la nota es mejor que anular y volver a pedir. La pantalla de
 * la estacion la vera actualizada.
 */
export async function setItemNote(
  itemId: string,
  note: string,
): Promise<FormState> {
  await requireStaff();

  const limpia = note.trim().slice(0, 140);

  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    select: { sessionId: true, paymentId: true, name: true },
  });

  if (!item) return formError("Esa línea ya no está.");
  if (item.paymentId) return formError("Esa línea ya se cobró.");

  await prisma.orderItem.update({
    where: { id: itemId },
    data: { note: limpia || null },
  });

  refresh(item.sessionId);

  return formSuccess(
    limpia ? `${item.name}: ${limpia}` : `Nota quitada de ${item.name}.`,
  );
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
/**
 * Correlativo del dia: el numero que se canta en la cocina.
 *
 * Lo comparten las comandas de preparacion y los resumenes de cobro, para que
 * los papeles que salen por la impresora lleven una unica numeracion y se
 * puedan buscar despues sin ambiguedad.
 */
async function siguienteNumero(tx: Prisma.TransactionClient) {
  const inicioDelDia = new Date();
  inicioDelDia.setHours(0, 0, 0, 0);

  const ultima = await tx.orderTicket.findFirst({
    where: { createdAt: { gte: inicioDelDia } },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  return (ultima?.number ?? 0) + 1;
}

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

  /*
   * El envio: un toque de "enviar", una ida a buscar el papel.
   *
   * Las comandas que se crean aca abajo son de estaciones distintas pero de un
   * mismo viaje del garzon, y el agente de impresion las junta en un solo papel
   * cuando comparten impresora — que es el caso del local, con una sola
   * termica. Sin esto salian de a una con segundos de por medio y la garzona
   * tenia que quedarse esperando la segunda al lado de la ranura.
   */
  const batchId = randomUUID();

  const creadas = await prisma.$transaction(async (tx) => {
    let numero = await siguienteNumero(tx);
    const resultado: Array<{ station: Station; number: number }> = [];

    for (const [station, itemIds] of porEstacion) {
      const ticket = await tx.orderTicket.create({
        data: {
          sessionId,
          number: numero,
          station,
          batchId,
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

  /*
   * Lo que hay que ir a hacer, no lo que hizo el sistema.
   *
   * Decia "Comanda enviada a barra #7 y cocina #8", que suena a que el pedido
   * ya llego a destino. No llego: con una sola impresora, lo que acaba de pasar
   * es que en la caja hay un papel esperando que alguien lo parta y lo reparta.
   * Mientras eso no ocurra, la barra no se entero de nada.
   *
   * Los numeros de comanda se caen del mensaje. No se usan para nada en la
   * mano —la garzona no le canta "#7" a nadie— y ocupaban el lugar de lo unico
   * que si tiene que leer: adonde va lo que va a retirar.
   */
  const estaciones = creadas.map((ticket) =>
    ticket.station === "BARRA" ? "la barra" : "la cocina",
  );

  const mensaje =
    estaciones.length > 1
      ? `Retira el papel en la caja: va partido, una mitad para ${estaciones.join(" y otra para ")}.`
      : `Retira el papel en la caja y llévalo a ${estaciones[0]}.`;

  return formSuccess(mensaje);
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

// --- Comandas en la estacion -------------------------------------------------

/**
 * El garzon se lleva la comanda de la estacion.
 *
 * Es el unico movimiento que le queda a una comanda, y no lo hace la cocina:
 * lo hace quien va a buscar el plato, desde su telefono. En la cocina no hay
 * manos limpias para tocar una pantalla —estan mojadas o con grasa—, asi que
 * su tablero es algo que solo se mira: sale de ahi cuando alguien se la lleva.
 *
 * Es idempotente a proposito: dos garzones que tocan a la vez, o el mismo
 * tocando dos veces porque la pantalla tardo, no tienen por que ver un error.
 */
export async function markTicketPickedUp(ticketId: string): Promise<FormState> {
  await requireStaff();

  const ticket = await prisma.orderTicket.findUnique({
    where: { id: ticketId },
    select: { number: true, prep: true, station: true, sessionId: true },
  });

  if (!ticket) return formError("Esa comanda ya no está.");

  if (ticket.prep === "RETIRADA") {
    return formSuccess(`La comanda #${ticket.number} ya estaba retirada.`);
  }

  await prisma.orderTicket.update({
    where: { id: ticketId },
    data: { prep: "RETIRADA", pickedUpAt: new Date() },
  });

  if (ticket.station) {
    revalidatePath(`/staff/${ticket.station === "BARRA" ? "barra" : "cocina"}`);
  }
  refresh(ticket.sessionId);

  return formSuccess(`Comanda #${ticket.number} retirada.`);
}

// --- BarzuCard ---------------------------------------------------------------

/**
 * Presenta una BarzuCard en la mesa.
 *
 * Es el unico paso previo del programa: sin tarjeta en la mesa no se puede
 * aplicar ningun beneficio, y con ella aplicados quedan a un toque. Se pide
 * una vez, al principio, y vale para toda la noche —tambien para los cobros
 * separados por comensal—.
 *
 * Acepta las tres formas en que la tarjeta llega a la garzona: el QR
 * escaneado, el numero de 16 digitos tipeado y el codigo dictado en voz alta.
 */
export async function attachCard(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = posCardSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Escanea o escribe la tarjeta.", fieldErrors(parsed.error));
  }

  const { sessionId, input } = parsed.data;

  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true },
  });

  if (!session) return formError("La mesa no existe.");
  if (session.status === "CLOSED") return formError("La mesa ya está cerrada.");

  const parsedInput = normalizeCardInput(input);

  /*
   * El cupon que el socio emite desde su telefono tambien identifica su
   * tarjeta. Aceptarlo evita el callejon sin salida de escanear el QR
   * equivocado y que la pantalla diga "no existe" teniendo al socio delante.
   */
  const card =
    parsedInput.kind === "number"
      ? await prisma.barzuCard.findUnique({
          where: { cardNumber: parsedInput.value },
          include: { member: { select: { fullName: true, birthDate: true } } },
        })
      : parsedInput.kind === "voucher" || parsedInput.kind === "voucherCode"
        ? await prisma.promotionVoucher
            .findUnique({
              where:
                parsedInput.kind === "voucher"
                  ? { token: parsedInput.value }
                  : { code: parsedInput.value },
              include: {
                card: {
                  include: {
                    member: { select: { fullName: true, birthDate: true } },
                  },
                },
              },
            })
            .then((voucher) => voucher?.card ?? null)
        : await prisma.barzuCard.findUnique({
            where: { qrToken: parsedInput.value },
            include: { member: { select: { fullName: true, birthDate: true } } },
          });

  if (!card) return formError("Esa BarzuCard no existe.");
  if (card.status !== "ACTIVE") return formError("La tarjeta está suspendida.");

  await prisma.tableSession.update({
    where: { id: sessionId },
    data: { cardId: card.id },
  });

  refresh(sessionId);

  return formSuccess(`BarzuCard de ${card.member.fullName}`, {
    cardId: card.id,
  });
}

/**
 * Saca la tarjeta de la mesa.
 *
 * Los beneficios ya aplicados se anulan con ella: existen porque habia una
 * tarjeta, y dejarlos vivos seria regalar el descuento a quien no la tiene.
 */
export async function detachCard(sessionId: string): Promise<FormState> {
  await requireStaff();

  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true },
  });

  if (!session) return formError("La mesa no existe.");
  if (session.status === "CLOSED") return formError("La mesa ya está cerrada.");

  await prisma.$transaction(async (tx) => {
    await anularBeneficios(tx, { sessionId });

    await tx.tableSession.update({
      where: { id: sessionId },
      data: { cardId: null },
    });
  });

  refresh(sessionId);

  return formSuccess("Tarjeta quitada de la mesa.");
}

/**
 * Anula canjes vivos y devuelve el cupo al tope de cada promocion.
 *
 * `redeemedCount` es el contador global de la promocion ("solo 100 cupos"):
 * si un canje se deshace, el cupo tiene que volver o la promocion se agota
 * sola a fuerza de correcciones.
 */
async function anularBeneficios(
  tx: Prisma.TransactionClient,
  where: { sessionId: string } | { id: string },
) {
  const vivos = await tx.redemption.findMany({
    where: { ...where, voidedAt: null },
    select: { id: true, promotionId: true },
  });

  if (vivos.length === 0) return 0;

  await tx.redemption.updateMany({
    where: { id: { in: vivos.map((redemption) => redemption.id) } },
    data: { voidedAt: new Date(), discountCents: 0 },
  });

  for (const redemption of vivos) {
    await tx.promotion.update({
      where: { id: redemption.promotionId },
      data: { redeemedCount: { decrement: 1 } },
    });
  }

  // Las lineas de cortesia que trajo el beneficio dejan de ser cortesia: si el
  // producto ya salio de la cocina, se cobra.
  await tx.orderItem.updateMany({
    where: {
      ...("sessionId" in where ? { sessionId: where.sessionId } : {}),
      courtesy: true,
      paymentId: null,
    },
    data: { courtesy: false },
  });

  return vivos.length;
}

/**
 * Aplica un beneficio a una cuenta.
 *
 * Lo que ve la garzona es un toque; lo que ocurre debajo es: se revalida la
 * tarjeta, se revalida la promocion, se agrega el producto si es una cortesia
 * que todavia no esta en la cuenta y se deja registrado el canje. El descuento
 * en si no se guarda como monto: se recalcula sobre las lineas cada vez que se
 * lee la cuenta (ver getSessionDetail), de modo que anular un producto ajusta
 * el descuento solo.
 */
export async function applyPromotion(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireStaff();

  const parsed = posPromotionSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) return formError("No se pudo aplicar el beneficio.");

  const { sessionId, promotionId, dinerId } = parsed.data;

  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true, cardId: true },
  });

  if (!session) return formError("La mesa no existe.");
  if (session.status === "CLOSED") return formError("La mesa ya está cerrada.");

  // La condicion de todo el programa: sin tarjeta, no hay descuento.
  if (!session.cardId) {
    return formError("Primero escanea la BarzuCard del cliente.");
  }

  const [card, promotion] = await Promise.all([
    prisma.barzuCard.findUnique({
      where: { id: session.cardId },
      // El socio viaja con la tarjeta: las promos de cumpleanos se habilitan
      // contra su fecha de nacimiento.
      select: {
        id: true,
        status: true,
        member: { select: { birthDate: true } },
      },
    }),
    prisma.promotion.findUnique({
      where: { id: promotionId },
      include: { product: { select: { id: true, name: true } } },
    }),
  ]);

  if (!card) return formError("Esa BarzuCard no existe.");
  if (!promotion) return formError("Esa promoción no existe.");

  const yaEnLaMesa = await prisma.redemption.findFirst({
    where: { sessionId, promotionId, voidedAt: null },
    select: { id: true },
  });

  if (yaEnLaMesa) return formError("Ese beneficio ya está en la mesa.");

  const usos = await prisma.redemption.count({
    where: { cardId: card.id, promotionId, voidedAt: null },
  });

  const eligibility = checkEligibility({
    promotion,
    card,
    redemptionsForThisPromotion: usos,
    birthDate: card.member.birthDate,
  });

  if (!eligibility.ok) return formError(eligibility.reason);

  const receiptCode = generateReceiptCode();

  const resultado = await prisma.$transaction(async (tx) => {
    let agregado: string | null = null;

    /*
     * Cortesia cuyo producto no esta en la cuenta.
     *
     * Se carga la linea en vez de pedirle a la garzona que la cargue aparte:
     * asi la comanda sale hacia la cocina —el producto hay que prepararlo
     * igual— y el descuento tiene sobre que aplicarse.
     */
    if (promotion.type === "FREE_ITEM" && promotion.productId) {
      const presente = await tx.orderItem.findFirst({
        where: {
          sessionId,
          dinerId: dinerId || null,
          productId: promotion.productId,
          status: { not: "CANCELLED" },
          paymentId: null,
        },
        select: { id: true },
      });

      if (!presente) {
        const producto = await tx.menuProduct.findUnique({
          where: { id: promotion.productId },
          include: { category: { select: { station: true } } },
        });

        if (producto) {
          const precio = priceFor(producto);

          await tx.orderItem.create({
            data: {
              sessionId,
              dinerId: dinerId || null,
              productId: producto.id,
              name: producto.name,
              unitPriceCents: precio.unitPriceCents,
              discountCents: precio.discountCents,
              discountLabel: precio.discountLabel,
              quantity: 1,
              station: stationFor(producto),
              courtesy: true,
              note: promotion.title,
              createdById: user.userId,
            },
          });

          agregado = producto.name;
        }
      }
    }

    const redemption = await tx.redemption.create({
      data: {
        promotionId,
        cardId: card.id,
        sessionId,
        dinerId: dinerId || null,
        staffUserId: user.userId,
        receiptCode,
        note: promotion.title,
      },
      select: { id: true },
    });

    await tx.promotion.update({
      where: { id: promotionId },
      data: { redeemedCount: { increment: 1 } },
    });

    return { redemptionId: redemption.id, agregado };
  });

  refresh(sessionId);

  return formSuccess(
    resultado.agregado
      ? `${promotion.title} · se agregó ${resultado.agregado} de cortesía`
      : `${promotion.title} aplicada`,
    { receiptCode, ...resultado },
  );
}

/** Deshace un beneficio aplicado en la mesa. */
export async function removePromotion(
  redemptionId: string,
): Promise<FormState> {
  await requireStaff();

  const redemption = await prisma.redemption.findUnique({
    where: { id: redemptionId },
    select: { id: true, sessionId: true, voidedAt: true },
  });

  if (!redemption) return formError("Ese beneficio no existe.");
  if (redemption.voidedAt) return formError("Ese beneficio ya se quitó.");

  await prisma.$transaction(async (tx) => {
    await anularBeneficios(tx, { id: redemptionId });
  });

  refresh(redemption.sessionId ?? undefined);

  return formSuccess("Beneficio quitado.");
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

  const { sessionId, dinerId, method } = parsed.data;

  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true, cardId: true },
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
      productId: true,
      product: { select: { categoryId: true } },
      unitPriceCents: true,
      discountCents: true,
      quantity: true,
      dinerId: true,
    },
  });

  if (items.length === 0) return formError("No hay nada pendiente de cobro.");

  const subtotalCents = items.reduce(
    (total, item) => total + item.unitPriceCents * item.quantity,
    0,
  );
  const cartaCents = items.reduce(
    (total, item) => total + item.discountCents * item.quantity,
    0,
  );
  const consumoCents = items.reduce((total, item) => total + lineTotal(item), 0);

  /*
   * Beneficios de BarzuCard de esta cuenta.
   *
   * Se recalculan aca, contra las lineas que realmente se estan cobrando, y
   * recien en este momento se congelan: es el unico instante en que el monto
   * deja de poder cambiar. Cobrar por comensal toma solo los beneficios de esa
   * pestaña, que son los que la garzona le aplico.
   */
  const beneficios = await prisma.redemption.findMany({
    where: {
      sessionId,
      voidedAt: null,
      discountCents: 0,
      ...(dinerId ? { dinerId } : { dinerId: null }),
    },
    include: { promotion: true },
  });

  const lineas = items.map((item) => ({
    id: item.id,
    productId: item.productId,
    categoryId: item.product?.categoryId ?? null,
    unitPriceCents: item.unitPriceCents,
    discountCents: item.discountCents,
    quantity: item.quantity,
  }));

  let beneficioCents = 0;
  const congelados: Array<{ id: string; discountCents: number }> = [];

  for (const beneficio of beneficios) {
    const resuelto = resolvePromotion(beneficio.promotion, lineas);
    // Nunca por debajo de cero: varios beneficios sobre una cuenta chica no
    // pueden terminar en que el local le deba plata al cliente.
    const aplicado = Math.min(
      resuelto.discountCents,
      Math.max(0, consumoCents - beneficioCents),
    );

    beneficioCents += aplicado;
    congelados.push({ id: beneficio.id, discountCents: aplicado });
  }

  const discountCents = cartaCents + beneficioCents;
  const totalCents = Math.max(0, consumoCents - beneficioCents);

  // La tarjeta presentada en la mesa queda en el cobro: es lo que despues
  // permite ver que consumo trajo el programa.
  const cardId = session.cardId;

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

    // Los beneficios de esta cuenta quedan con su monto definitivo.
    for (const congelado of congelados) {
      await tx.redemption.update({
        where: { id: congelado.id },
        data: { discountCents: congelado.discountCents },
      });
    }

    /*
     * El resumen del cobro tambien se imprime.
     *
     * Va por la misma cola que las comandas —y por lo tanto sobrevive a un
     * corte de red o a una impresora sin papel—, pero sin estacion: no lo
     * prepara nadie, asi que no aparece en las pantallas de barra ni de
     * cocina. Lo que lleva impreso sale de `paymentId`, no de las lineas: al
     * terminar esta transaccion los productos ya quedaron asociados al pago.
     */
    await tx.orderTicket.create({
      data: {
        sessionId,
        number: await siguienteNumero(tx),
        kind: "COBRO",
        paymentId: payment.id,
        createdById: user.userId,
      },
    });

  });

  refresh(sessionId);

  return formSuccess(
    beneficioCents > 0
      ? `Cobrado · ${code} · BarzuCard descontó ${Math.round(beneficioCents / 100).toLocaleString("es-CL")}`
      : `Cobrado · ${code}`,
    { code, totalCents, discountCents: beneficioCents },
  );
}
