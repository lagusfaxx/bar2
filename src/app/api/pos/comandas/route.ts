import { timingSafeEqual } from "node:crypto";

import { STATION_LABELS } from "@/lib/pos";
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
    take: 20,
    include: {
      session: {
        select: {
          code: true,
          table: { select: { number: true, name: true } },
        },
      },
      items: {
        orderBy: { createdAt: "asc" },
        include: { diner: { select: { label: true } } },
      },
    },
  });

  return Response.json(
    {
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        number: ticket.number,
        station: ticket.station,
        stationLabel: STATION_LABELS[ticket.station],
        createdAt: ticket.createdAt.toISOString(),
        table: {
          number: ticket.session.table.number,
          name: ticket.session.table.name,
        },
        sessionCode: ticket.session.code,
        items: ticket.items
          .filter((item) => item.status !== "CANCELLED")
          .map((item) => ({
            quantity: item.quantity,
            name: item.name,
            note: item.note,
            // El comensal va impreso: la barra arma el pedido separado y el
            // garzon sabe delante de quien dejar cada trago.
            diner: item.diner?.label ?? null,
          })),
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
