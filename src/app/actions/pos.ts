"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import type { Station } from "@/generated/prisma/enums";
import { requireStaff } from "@/lib/auth";
import { formError, formSuccess, type FormState } from "@/lib/form-state";
import {
  generateDirectSaleCode,
  generatePaymentCode,
  generateSessionCode,
  generateWalkInCode,
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
  posDirectSaleSchema,
  posItemSchema,
  posOpenTableSchema,
  posPaymentSchema,
  posPromotionSchema,
  posWalkInSchema,
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
    },
    select: { id: true },
  });

  refresh(session.id);
  return formSuccess(`Mesa ${table.number} abierta.`, { sessionId: session.id });
}

/**
 * Abre una cuenta para gente que no se sienta.
 *
 * Es la misma cuenta de una mesa sin la mesa: mismas lineas, mismas comandas,
 * mismo cobro, mismos beneficios de BarzuCard. Lo unico que cambia es que no
 * cuelga de ningun numero, y por eso pueden convivir veinte a la vez —que es
 * justamente lo que una mesa tiene prohibido—.
 *
 * Sirve para los dos usos de la barra con una sola pieza:
 *
 * - **Venta al paso**: sin etiqueta. Se abre, se carga, se cobra y se cierra
 *   sola (ver `payAccount`). Nunca llega a aparecer en la pantalla de sala.
 * - **Cuenta de pie**: con etiqueta. Queda listada como una mesa mas hasta que
 *   la persona se va, y se cobra cuando pide la cuenta.
 *
 * La diferencia entre las dos la hace el garzon escribiendo o no un nombre, y
 * nada mas: no hay dos flujos que aprender ni una decision que tomar antes de
 * empezar a cargar, que es lo que importa con gente esperando de pie.
 */
export async function openWalkIn(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireStaff();

  const parsed = posWalkInSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa los datos de la cuenta.", fieldErrors(parsed.error));
  }

  const { label, guests, note } = parsed.data;

  const session = await prisma.tableSession.create({
    data: {
      kind: "PIE",
      label: label || null,
      code: generateWalkInCode(),
      guests,
      note: note || null,
      openedById: user.userId,
    },
    select: { id: true },
  });

  refresh(session.id);

  return formSuccess(label ? `Cuenta de ${label} abierta.` : "Cuenta de pie abierta.", {
    sessionId: session.id,
  });
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

  // Como nombrar lo que se esta cerrando: una cuenta de pie no es "la mesa".
  const que = session?.kind === "PIE" ? "La cuenta" : "La mesa";

  if (!session) return formError("La mesa no existe.");
  if (session.status === "CLOSED") return formSuccess(`${que} ya estaba cerrada.`);

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

  return formSuccess(session.kind === "PIE" ? "Cuenta cerrada." : "Mesa cerrada.");
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

/**
 * La cortesia de una promocion se quedo sin elegir.
 *
 * Existe como error y no como retorno porque tiene que cortar la transaccion
 * del canje: ver `applyPromotion`.
 */
class CortesiaSinElegir extends Error {}

/**
 * Comprueba lo elegido contra lo que el producto ofrece.
 *
 * Se valida aca y no en el esquema del formulario porque la lista de respuestas
 * vive en la carta, y la carta cambia: el garzon puede tener la pantalla
 * abierta desde antes de que alguien sacara "Fanta" de las opciones.
 *
 * Devuelve el texto a guardar, o un error para mostrar tal cual.
 *
 * Que sea obligatorio cuando el producto pregunta algo es el punto entero de
 * esto: una promo con bebida sin bebida elegida es una comanda que la barra no
 * puede preparar y que termina en alguien caminando de vuelta a preguntar.
 */
function resolveVariant(
  product: { name: string; optionLabel: string | null; options: string[] },
  elegido: string | undefined,
): { ok: true; variant: string | null } | { ok: false; error: string } {
  const pregunta = product.optionLabel?.trim() || "una opción";

  if (product.options.length === 0) {
    // Un producto que no pregunta nada no puede llegar con respuesta: seria una
    // opcion que se quito de la carta y quedo viajando en una pantalla abierta.
    return { ok: true, variant: null };
  }

  const limpio = elegido?.trim();

  if (!limpio) {
    return { ok: false, error: `Elige ${pregunta.toLowerCase()} para ${product.name}.` };
  }

  // Comparacion tolerante a mayusculas y espacios, pero se guarda la forma
  // exacta de la carta: asi la barra lee siempre "Coca-Cola" y no "coca cola".
  const exacto = product.options.find(
    (opcion) => opcion.trim().toLowerCase() === limpio.toLowerCase(),
  );

  if (!exacto) {
    return {
      ok: false,
      error: `"${limpio}" ya no es una opción de ${product.name}. Vuelve a elegir.`,
    };
  }

  return { ok: true, variant: exacto };
}

export async function addItem(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireStaff();

  const parsed = posItemSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa el producto.", fieldErrors(parsed.error));
  }

  const { sessionId, productId, dinerId, quantity, note, variant } = parsed.data;

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

  const elegido = resolveVariant(product, variant);
  if (!elegido.ok) return formError(elegido.error);

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
      variant: elegido.variant,
      note: note || null,
      station: stationFor(product),
      createdById: user.userId,
    },
    select: { id: true },
  });

  refresh(sessionId);

  // Se devuelve la linea recien creada para poder ofrecer "agregar nota" sin
  // tener que buscarla en la cuenta.
  return formSuccess(
    elegido.variant
      ? `${quantity} × ${product.name} · ${elegido.variant}`
      : `${quantity} × ${product.name}`,
    { itemId: created.id, name: product.name },
  );
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

  const { sessionId, promotionId, dinerId, variant } = parsed.data;

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

  try {
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

          /*
           * Una cortesia que regala una bebida tiene que decir cual.
           *
           * Es el mismo problema que venderla, y por eso se resuelve con la
           * misma funcion: la promocion "un pisco sour de cortesia" no le
           * sirve a la barra si el producto pregunta el sabor y nadie
           * contesto. La eleccion la hace la garzona al aplicar el beneficio,
           * en la misma hoja donde lo elige.
           */
          const elegido = resolveVariant(producto, variant);
          if (!elegido.ok) throw new CortesiaSinElegir(elegido.error);

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
              variant: elegido.variant,
              station: stationFor(producto),
              courtesy: true,
              note: promotion.title,
              createdById: user.userId,
            },
          });

          agregado = elegido.variant
            ? `${producto.name} · ${elegido.variant}`
            : producto.name;
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
  } catch (error) {
    /*
     * Falta elegir el sabor de la cortesia.
     *
     * Se lanza desde dentro de la transaccion para que no quede a medias —sin
     * esto, el canje quedaria registrado y consumido y la linea de cortesia
     * no—, y se atrapa aca para devolverlo como lo que es: algo que la garzona
     * puede arreglar en el toque siguiente, no un error del sistema.
     */
    if (error instanceof CortesiaSinElegir) return formError(error.message);
    throw error;
  }
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

  const { sessionId, dinerId, method, soloCompartido } = parsed.data;

  /*
   * Que parte de la cuenta se esta cobrando.
   *
   * Tres, y hay que distinguirlas: un comensal, la cuenta compartida sola, o
   * todo lo pendiente de la mesa. Antes eran dos —"con comensal" o "todo"— y
   * por eso lo compartido no se podia cobrar aparte: no lleva comensal, asi
   * que caia en el "todo" y arrastraba el consumo de los demas.
   */
  const soloLaMesa = soloCompartido === "1" && !dinerId;

  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true, cardId: true, kind: true, label: true },
  });

  if (!session) return formError("La mesa no existe.");

  // Solo lo que falta pagar de esa cuenta. Si es un comensal, lo suyo; si no,
  // todo lo pendiente de la mesa (incluido lo compartido).
  const items = await prisma.orderItem.findMany({
    where: {
      sessionId,
      status: { not: "CANCELLED" },
      paymentId: null,
      ...(dinerId ? { dinerId } : soloLaMesa ? { dinerId: null } : {}),
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
      /*
       * Los de la pestaña que se cobra; cobrando la mesa entera, todos.
       *
       * Antes el cobro de la mesa completa tomaba solo los beneficios sin
       * comensal, y los de Victor y Daniel quedaban afuera: la pantalla
       * mostraba el total con su descuento y el papel salia mas caro, con el
       * beneficio ademas sin congelar. Si se cobra el consumo de todos,
       * corresponden los descuentos de todos.
       */
      ...(dinerId ? { dinerId } : soloLaMesa ? { dinerId: null } : {}),
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
    dinerId: item.dinerId,
  }));

  let beneficioCents = 0;
  const congelados: Array<{ id: string; discountCents: number }> = [];

  for (const beneficio of beneficios) {
    /*
     * Cada beneficio se resuelve contra el consumo de SU pestaña.
     *
     * Es como se calcula en la cuenta que el garzon le muestra al cliente, y
     * es lo unico que da el mismo numero cobrando de una forma o de la otra:
     * un 2x1 aplicado a Victor no puede empezar a mirar los tragos de Daniel
     * porque se cobro la mesa entera.
     */
    const suyas = lineas.filter(
      (linea) => linea.dinerId === (beneficio.dinerId ?? null),
    );
    const resuelto = resolvePromotion(beneficio.promotion, suyas);
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

  /*
   * Una cuenta de pie pagada entera se cierra sola.
   *
   * Una mesa sigue abierta despues de cobrar porque la gente sigue sentada y
   * casi siempre pide otra vuelta. De pie es al reves: se paga y se camina. Si
   * quedaran abiertas, la barra terminaria la noche con cuarenta cuentas en
   * cero que alguien tendria que ir cerrando a mano una por una —y entre ellas,
   * las de verdad—.
   *
   * Solo cuando no queda NADA sin cobrar en toda la cuenta: cobrarle a uno de
   * un grupo que sigue tomando no la cierra.
   *
   * La venta al paso termina aca sin haber existido para nadie mas: se abrio,
   * se cargo y se cerro en el mismo minuto.
   */
  let cerrada = false;

  if (session.kind === "PIE") {
    const pendientes = await prisma.orderItem.count({
      where: { sessionId, status: { not: "CANCELLED" }, paymentId: null },
    });

    if (pendientes === 0) {
      await prisma.$transaction([
        prisma.tableSession.update({
          where: { id: sessionId },
          data: { status: "CLOSED", closedAt: new Date() },
        }),
        // Lo mismo que al cerrar una mesa: no dejar comandas envejeciendo en la
        // pantalla de una estacion cuando ya no hay a quien entregarselas.
        prisma.orderTicket.updateMany({
          where: { sessionId, kind: "COMANDA", prep: "PENDIENTE" },
          data: { prep: "RETIRADA", pickedUpAt: new Date() },
        }),
      ]);

      cerrada = true;
      revalidatePath("/staff/cocina");
      revalidatePath("/staff/barra");
    }
  }

  refresh(sessionId);

  return formSuccess(
    beneficioCents > 0
      ? `Cobrado · ${code} · BarzuCard descontó ${Math.round(beneficioCents / 100).toLocaleString("es-CL")}`
      : `Cobrado · ${code}`,
    { code, totalCents, discountCents: beneficioCents, closed: cerrada },
  );
}

// --- Venta directa de mostrador ----------------------------------------------

/**
 * Cobro directo: se pide, se paga y se entrega, sin mesa de por medio.
 *
 * Es la otra mitad de la noche —la cerveza que alguien viene a buscar a la
 * barra— y hasta ahora no se registraba en ninguna parte: entraba la plata y
 * el consumo no quedaba anotado, asi que el cierre de caja y el ranking de lo
 * que mas se vende iban cortos todos los dias. Aca esa venta queda igual de
 * anotada que la de una mesa: mismas lineas, mismo cobro, mismo comprobante.
 *
 * Todo pasa en una sola operacion —cuenta, lineas, cobro y papeles— porque en
 * el mostrador no hay nada que quede abierto esperando: si algo falla, no se
 * cobro y no queda una cuenta huerfana dando vueltas.
 *
 * Los precios NO vienen del cliente. Llegan el producto y cuantos lleva, y el
 * resto se relee de la carta: es la misma regla que en la mesa y la unica
 * forma de que una pantalla vieja no cobre el precio del mes pasado.
 */
export async function directSale(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireStaff();

  const parsed = posDirectSaleSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa la venta.", fieldErrors(parsed.error));
  }

  const { customer, method, lines } = parsed.data;

  /*
   * Lo pedido, junto.
   *
   * Dos toques al mismo producto son una linea de dos, salvo que lleven
   * respuestas distintas: una Fanta y una Sprite son la misma promo y dos
   * lineas, porque la barra tiene que preparar cada una.
   */
  const cantidades = new Map<string, { productId: string; variant: string | null; quantity: number }>();

  for (const line of lines) {
    const variant = line.variant?.trim() || null;
    const clave = `${line.productId}|${variant ?? ""}`;
    const actual = cantidades.get(clave);

    if (actual) actual.quantity += line.quantity;
    else cantidades.set(clave, { productId: line.productId, variant, quantity: line.quantity });
  }

  const pedidos = [...cantidades.values()];
  const productIds = [...new Set(pedidos.map((pedido) => pedido.productId))];

  const productos = await prisma.menuProduct.findMany({
    where: { id: { in: productIds }, available: true },
    include: {
      category: { select: { id: true, station: true, active: true } },
    },
  });

  const porId = new Map(
    productos
      .filter((product) => product.category.active)
      .map((product) => [product.id, product] as const),
  );

  if (porId.size !== productIds.length) {
    return formError(
      "Hay algo del pedido que ya no está en la carta. Vuelve a cargarlo.",
    );
  }

  const now = new Date();

  const items = pedidos.map((pedido) => {
    const product = porId.get(pedido.productId)!;
    const priced = priceFor(product, now);

    return {
      productId: product.id,
      name: product.name,
      unitPriceCents: priced.unitPriceCents,
      discountCents: priced.discountCents,
      discountLabel: priced.discountLabel,
      quantity: pedido.quantity,
      variant: pedido.variant,
      station: stationFor(product),
    };
  });

  const subtotalCents = items.reduce(
    (total, item) => total + item.unitPriceCents * item.quantity,
    0,
  );
  const discountCents = items.reduce(
    (total, item) => total + item.discountCents * item.quantity,
    0,
  );
  const totalCents = items.reduce((total, item) => total + lineTotal(item), 0);

  /*
   * Los papeles que salen, y en que orden.
   *
   * Una comanda por estacion —lo que prepara la cocina y lo que prepara la
   * barra— y al final el comprobante del cobro. Igual que una mesa, con una
   * diferencia: no comparten envio. Con una sola impresora, dos comandas del
   * mismo envio salen pegadas en una sola tira para que el garzon haga un solo
   * viaje (ver `sendOrder`), y eso aca no sirve: quien cobra esta parado frente
   * al cliente y los papeles no van todos al mismo lado —uno a la cocina, uno a
   * la barra y uno a la mano del cliente—. Separados, el agente deja su pausa
   * entre uno y otro (PRINT_GAP_MS, tres segundos) y hay tiempo de retirar cada
   * papel antes de que salga el siguiente.
   *
   * El orden es el del recorrido: primero lo que hay que ir a encargar —cocina,
   * que es lo que mas tarda, y barra— y al final lo del cliente.
   */
  const estaciones = (["COCINA", "BARRA"] as const).filter((station) =>
    items.some((item) => item.station === station),
  );

  const code = generatePaymentCode();
  const sessionCode = generateDirectSaleCode();

  await prisma.$transaction(async (tx) => {
    const session = await tx.tableSession.create({
      data: {
        kind: "DIRECTA",
        /*
         * El nombre del cliente es el nombre de la cuenta.
         *
         * Es el mismo campo con el que se reconoce a una cuenta de pie —ahi
         * "Polera azul", aca "Juan"— y por eso sale solo donde ya se lee: el
         * titulo de la comanda, el papel del cobro y el cierre de caja. Vacio,
         * la venta se llama "Cobro directo" (ver `sessionTitle`).
         */
        label: customer || null,
        // Nace y muere aca: no hay nada que quede abierto en el mostrador.
        status: "CLOSED",
        closedAt: now,
        code: sessionCode,
        guests: 1,
        openedById: user.userId,
      },
      select: { id: true },
    });

    const payment = await tx.payment.create({
      data: {
        sessionId: session.id,
        code,
        subtotalCents,
        discountCents,
        totalCents,
        method,
        cashierId: user.userId,
      },
      select: { id: true },
    });

    const tickets = new Map<Station, string>();

    for (const station of estaciones) {
      const ticket = await tx.orderTicket.create({
        data: {
          sessionId: session.id,
          number: await siguienteNumero(tx),
          station,
          createdById: user.userId,
        },
        select: { id: true },
      });

      tickets.set(station, ticket.id);
    }

    for (const item of items) {
      await tx.orderItem.create({
        data: {
          sessionId: session.id,
          productId: item.productId,
          name: item.name,
          variant: item.variant,
          unitPriceCents: item.unitPriceCents,
          discountCents: item.discountCents,
          discountLabel: item.discountLabel,
          quantity: item.quantity,
          station: item.station,
          // Ya entregado y ya cobrado: no hay estado intermedio que esperar.
          status: "SENT",
          ticketId: tickets.get(item.station) ?? null,
          paymentId: payment.id,
          createdById: user.userId,
        },
      });
    }

    await tx.orderTicket.create({
      data: {
        sessionId: session.id,
        number: await siguienteNumero(tx),
        kind: "COBRO",
        paymentId: payment.id,
        createdById: user.userId,
      },
    });
  });

  revalidatePath("/staff/pos");
  if (estaciones.includes("COCINA")) revalidatePath("/staff/cocina");
  if (estaciones.includes("BARRA")) revalidatePath("/staff/barra");

  return formSuccess(`Cobrado · ${code}`, {
    code,
    totalCents,
    discountCents,
    // Lo que va a salir por la impresora, en el orden en que sale: quien cobra
    // tiene que saber cuantos papeles esperar antes de soltar la caja.
    papeles: [...estaciones, "COBRO"],
  });
}
