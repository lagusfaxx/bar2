import { timingSafeEqual } from "node:crypto";

import { sessionTitle, STATION_LABELS } from "@/lib/pos";
import { prisma } from "@/lib/prisma";

/**
 * Cola de comandas para el agente de impresion del local.
 *
 * La app corre en un servidor de internet y las impresoras estan en la red del
 * bar, detras del router: el servidor no puede alcanzarlas. Por eso la
 * conexion la abre el local hacia afuera — un agente pregunta cada pocos
 * segundos si hay algo que imprimir (GET) y avisa como le fue (POST).
 *
 * Consecuencia util: si la impresora se queda sin papel o se cae internet, la
 * comanda sigue en la cola en vez de perderse.
 */

export const dynamic = "force-dynamic";

/** Cuantas veces se reintenta una comanda antes de dejarla para revision. */
const MAX_ATTEMPTS = 5;

/** Cuantas comandas se entregan por vuelta. */
const PAGE_SIZE = 20;

function authorized(request: Request) {
  const expected = process.env.PRINT_AGENT_TOKEN;

  // Sin token configurado la cola queda cerrada: es preferible no imprimir a
  // dejar las comandas del local abiertas a internet.
  if (!expected || expected.length < 16) return false;

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}

/** Comandas pendientes, con todo lo que hay que imprimir ya resuelto. */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const tickets = await prisma.orderTicket.findMany({
    where: { status: "PENDING", attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { number: "asc" },
    take: PAGE_SIZE,
    include: {
      session: {
        select: {
          code: true,
          guests: true,
          kind: true,
          label: true,
          table: { select: { number: true, name: true } },
        },
      },
      // Quien la mando. Con una sola impresora se juntan en la bandeja los
      // papeles de varias mesas y de varios garzones: el nombre es como cada
      // uno reconoce los suyos sin leer el detalle.
      createdBy: { select: { name: true } },
      items: {
        orderBy: { createdAt: "asc" },
        include: { diner: { select: { label: true } } },
      },
      // Solo lo traen las de cobro: el resumen se arma con las lineas que
      // quedaron asociadas a ese pago, no con las de la comanda.
      payment: {
        include: {
          diner: { select: { label: true } },
          cashier: { select: { name: true } },
          items: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  /*
   * Un envio no se parte entre dos vueltas de la cola.
   *
   * Si la barra y la cocina de una misma mesa cayeran una en el ultimo lugar
   * de esta tanda y la otra en la primera de la siguiente, el agente imprimiria
   * cada mitad por su lado y la garzona tendria que hacer los dos viajes que
   * este cambio viene a evitar. Cuando la ultima de la tanda pertenece a un
   * envio, se deja ese envio entero para la vuelta siguiente —cuatro segundos
   * despues— en vez de mandarlo cortado.
   *
   * Solo puede pasar con la cola llena, o sea con la impresora recuperandose de
   * una caida. Nunca deja nada sin imprimir: lo que se posterga encabeza la
   * proxima tanda.
   */
  const completos = (() => {
    if (tickets.length < PAGE_SIZE) return tickets;

    const ultimo = tickets[tickets.length - 1];
    if (!ultimo?.batchId) return tickets;

    const recortados = tickets.filter(
      (ticket) => ticket.batchId !== ultimo.batchId,
    );

    // Salvo que la tanda entera sea ese envio: ahi hay que mandarlo igual, o no
    // se imprime nunca.
    return recortados.length > 0 ? recortados : tickets;
  })();

  return Response.json(
    {
      tickets: completos.map((ticket) => ({
        id: ticket.id,
        number: ticket.number,
        kind: ticket.kind,
        station: ticket.station,
        stationLabel: ticket.station ? STATION_LABELS[ticket.station] : null,
        /*
         * El envio del que salio.
         *
         * El agente junta en un mismo papel las comandas que comparten envio
         * *y* impresora. La decision es suya y no del servidor a proposito: el
         * servidor no sabe cuantas impresoras hay en el local, y el dia que
         * lleguen la de barra y la de cocina cada mitad tiene que volver a
         * salir por su propia ranura sin tocar nada aca.
         */
        batchId: ticket.batchId,
        waiter: ticket.createdBy?.name ?? null,
        createdAt: ticket.createdAt.toISOString(),

        /*
         * De quien es el papel, en dos formas.
         *
         * `title` es la buena: "Mesa 4" o "Polera azul", ya resuelta aca. La
         * usa el agente al dia.
         *
         * `table` se sigue mandando —con la mesa cero cuando la cuenta es de
         * pie— por una razon concreta: el agente corre en un PC del local y se
         * actualiza a mano, asi que en cualquier momento puede haber uno viejo
         * dando vueltas. Uno viejo lee `table.number` sin preguntar; si le
         * llegara vacio, la comanda reventaria al imprimirse y se reintentaria
         * hasta quedar FALLIDA, o sea que la barra nunca veria el pedido. Asi
         * imprime "MESA 0" con el nombre debajo: feo, pero sale y se entiende.
         */
        title: sessionTitle(ticket.session),
        table: {
          number: ticket.session.table?.number ?? 0,
          name: ticket.session.table
            ? ticket.session.table.name
            : sessionTitle(ticket.session),
        },
        sessionCode: ticket.session.code,
        items: ticket.items
          .filter((item) => item.status !== "CANCELLED")
          .map((item) => ({
            quantity: item.quantity,
            name: item.name,
            // Lo elegido al pedirlo: la barra no puede servir "Promo con
            // bebida" sin saber cual.
            variant: item.variant,
            note: item.note,
            // El comensal va impreso: la barra arma el pedido separado y el
            // garzon sabe delante de quien dejar cada trago.
            diner: item.diner?.label ?? null,
          })),

        /*
         * Resumen del cobro, ya calculado.
         *
         * Se manda resuelto y no en bruto porque el agente de impresion corre
         * en un PC del local, sin acceso a la base y sin reglas de negocio:
         * su unico trabajo es convertir esto en papel. Que los totales salgan
         * del servidor evita que dos sitios distintos sumen y den distinto.
         */
        payment: ticket.payment
          ? {
              code: ticket.payment.code,
              paidAt: ticket.payment.paidAt.toISOString(),
              // A quien se le cobro: un comensal o la mesa entera.
              dinerLabel: ticket.payment.diner?.label ?? null,
              cashier: ticket.payment.cashier?.name ?? null,
              method: ticket.payment.method,
              subtotalCents: ticket.payment.subtotalCents,
              discountCents: ticket.payment.discountCents,
              totalCents: ticket.payment.totalCents,
              lines: ticket.payment.items.map((item) => ({
                quantity: item.quantity,
                name: item.name,
                // Lo que se cobro por esa linea, con su descuento aplicado.
                totalCents:
                  (item.unitPriceCents - item.discountCents) * item.quantity,
              })),
            }
          : null,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Acuse del agente: se imprimio, o fallo y por que. */
export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON invalido" }, { status: 400 });
  }

  const { id, ok, error } = (body ?? {}) as {
    id?: string;
    ok?: boolean;
    error?: string;
  };

  if (typeof id !== "string" || !id) {
    return Response.json({ error: "Falta el id de la comanda" }, { status: 400 });
  }

  const ticket = await prisma.orderTicket.findUnique({
    where: { id },
    select: { id: true, attempts: true },
  });

  if (!ticket) {
    return Response.json({ error: "Comanda no encontrada" }, { status: 404 });
  }

  if (ok) {
    await prisma.orderTicket.update({
      where: { id },
      data: { status: "PRINTED", printedAt: new Date(), lastError: null },
    });

    return Response.json({ status: "PRINTED" });
  }

  const attempts = ticket.attempts + 1;

  // Tras varios intentos se marca FAILED y deja de reintentarse sola: alguien
  // tiene que mirar la impresora. El garzon la reenvia desde su pantalla.
  await prisma.orderTicket.update({
    where: { id },
    data: {
      attempts,
      status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
      lastError: (error ?? "Error de impresion").slice(0, 300),
    },
  });

  return Response.json({
    status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
    attempts,
  });
}
